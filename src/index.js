// Cloudflare Workers AI Image Generator
// Using FLUX.1 [schnell] model for text-to-image generation

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve static frontend files
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(await getHTML(), {
        headers: {
          'Content-Type': 'text/html',
          ...corsHeaders
        }
      });
    }

    // API endpoint for image generation
    if (request.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const { prompt, steps = 4, numImages = 1 } = await request.json();

        // Validate input
        if (!prompt || prompt.length < 1 || prompt.length > 2048) {
          return new Response(
            JSON.stringify({ error: 'Prompt must be between 1 and 2048 characters' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            }
          );
        }

        if (steps < 1 || steps > 8) {
          return new Response(
            JSON.stringify({ error: 'Steps must be between 1 and 8' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            }
          );
        }

        if (numImages < 1 || numImages > 4) {
          return new Response(
            JSON.stringify({ error: 'Number of images must be between 1 and 4' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            }
          );
        }

        // Generate multiple images
        const images = [];
        const r2Keys = [];
        const timestamp = Date.now();

        for (let i = 0; i < numImages; i++) {
          try {
            // Call Cloudflare Workers AI for each image
            const response = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
              prompt: prompt,
              steps: parseInt(steps)
            });

            // 处理图像数据格式

            if (!response || !response.image) {
              throw new Error('No image data received from AI model');
            }

            let imageBuffer;
            let imageBase64;

            // Handle different response formats - FLUX.1 typically returns base64 string
            if (typeof response.image === 'string') {
              // If it's already base64 encoded (most common case for FLUX.1)
              imageBase64 = response.image;
              // Convert base64 to buffer for R2 storage
              const binaryString = atob(response.image);
              imageBuffer = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                imageBuffer[j] = binaryString.charCodeAt(j);
              }
            } else if (response.image instanceof ArrayBuffer) {
              imageBuffer = new Uint8Array(response.image);
              imageBase64 = btoa(String.fromCharCode(...imageBuffer));
            } else if (response.image && typeof response.image.arrayBuffer === 'function') {
              // If it's a readable stream or blob
              const buffer = await response.image.arrayBuffer();
              imageBuffer = new Uint8Array(buffer);
              imageBase64 = btoa(String.fromCharCode(...imageBuffer));
            } else {
              console.error('Unsupported image format:', typeof response.image, response.image);
              throw new Error('Unsupported image format from AI model');
            }

            // Store image in R2
            const imageKey = `images/${timestamp}-${i + 1}.png`;
            
            await env.IMAGES_BUCKET.put(imageKey, imageBuffer, {
              httpMetadata: {
                contentType: 'image/png',
                cacheControl: 'public, max-age=31536000', // 1 year cache
              },
              customMetadata: {
                prompt: prompt,
                steps: steps.toString(),
                timestamp: timestamp.toString(),
                imageIndex: (i + 1).toString(),
                totalImages: numImages.toString()
              }
            });
            
            images.push({
              base64: `data:image/png;base64,${imageBase64}`,
              r2Key: imageKey,
              index: i + 1
            });
            
            r2Keys.push(imageKey);
          } catch (error) {
            console.error(`Failed to generate image ${i + 1}:`, error);
            // Continue with other images even if one fails
          }
        }

        if (images.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Failed to generate any images' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            }
          );
        }

        // Store metadata in KV for history
        const historyKey = `history:${timestamp}`;
        await env.IMAGE_STORE.put(historyKey, JSON.stringify({
          prompt,
          steps,
          numImages,
          timestamp,
          r2Keys,
          generatedCount: images.length
        }), { expirationTtl: 86400 * 30 }); // 30 days

        return new Response(JSON.stringify({
          success: true,
          images,
          timestamp,
          prompt,
          steps,
          numImages,
          generatedCount: images.length,
          r2Keys
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      } catch (error) {
        console.error('Generation error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to generate image', details: error.message }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }
    }

    // API endpoint for history
    if (request.method === 'GET' && url.pathname === '/api/history') {
      try {
        const list = await env.IMAGE_STORE.list({ prefix: 'history:' });
        const history = await Promise.all(
          list.keys.slice(0, 20).map(async (key) => {
            const data = await env.IMAGE_STORE.get(key.name);
            return JSON.parse(data);
          })
        );

        return new Response(JSON.stringify(history.sort((a, b) => b.timestamp - a.timestamp)), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch history' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          }
        );
      }
    }

    // API endpoint for serving images from R2
    if (request.method === 'GET' && url.pathname.startsWith('/api/image/')) {
      try {
        const imageKey = url.pathname.replace('/api/image/', '');
        const object = await env.IMAGES_BUCKET.get(imageKey);
        
        if (!object) {
          return new Response('Image not found', {
            status: 404,
            headers: corsHeaders
          });
        }

        return new Response(object.body, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000',
            ...corsHeaders
          }
        });
      } catch (error) {
        return new Response('Failed to fetch image', {
          status: 500,
          headers: corsHeaders
        });
      }
    }

    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders
    });
  }
};

// Frontend HTML with embedded CSS and JavaScript
async function getHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 图像生成器 - FLUX.1 [schnell]</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            color: white;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }

        @media (max-width: 768px) {
            .main-content {
                grid-template-columns: 1fr;
            }
        }

        .input-panel, .result-panel {
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        .form-group {
            margin-bottom: 25px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #4a5568;
        }

        .prompt-input {
            width: 100%;
            min-height: 120px;
            padding: 15px;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-size: 16px;
            resize: vertical;
            transition: border-color 0.3s ease;
            font-family: inherit;
        }

        .prompt-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .char-counter {
            text-align: right;
            font-size: 14px;
            color: #718096;
            margin-top: 5px;
        }

        .char-counter.warning {
            color: #f56565;
        }

        .steps-group {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .steps-input {
            flex: 1;
            padding: 12px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 16px;
        }

        .steps-display {
            font-weight: 600;
            color: #667eea;
            min-width: 60px;
        }

        .generate-btn {
            width: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .generate-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }

        .generate-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .loading-spinner {
            display: none;
            width: 20px;
            height: 20px;
            border: 2px solid transparent;
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .result-panel h3 {
            margin-bottom: 20px;
            color: #4a5568;
            font-size: 1.3rem;
        }

        .result-image {
            width: 100%;
            max-width: 100%;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 15px;
        }

        .images-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 15px;
        }

        .image-item {
            position: relative;
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            transition: transform 0.3s ease;
        }

        .image-item:hover {
            transform: scale(1.05);
        }

        .image-item img {
            width: 100%;
            height: auto;
            display: block;
        }

        .image-index {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }

        .download-btn {
            position: absolute;
            bottom: 8px;
            right: 8px;
            background: rgba(102, 126, 234, 0.9);
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .image-item:hover .download-btn {
            opacity: 1;
        }

        .result-placeholder {
            width: 100%;
            height: 300px;
            background: #f7fafc;
            border: 2px dashed #cbd5e0;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #a0aec0;
            font-size: 16px;
        }

        .result-info {
            background: #f7fafc;
            padding: 15px;
            border-radius: 8px;
            font-size: 14px;
            color: #4a5568;
        }

        .result-info div {
            margin-bottom: 5px;
        }

        .history-section {
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }

        .history-section h3 {
            margin-bottom: 20px;
            color: #4a5568;
            font-size: 1.3rem;
        }

        .history-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
        }

        .history-item {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            cursor: pointer;
        }

        .history-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }

        .history-item img {
            width: 100%;
            height: 150px;
            object-fit: cover;
        }

        .history-item-info {
            padding: 12px;
            background: white;
        }

        .history-item-prompt {
            font-size: 12px;
            color: #4a5568;
            margin-bottom: 5px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .history-item-meta {
            font-size: 11px;
            color: #a0aec0;
        }

        .error-message {
            background: #fed7d7;
            color: #c53030;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #f56565;
        }

        .success-message {
            background: #c6f6d5;
            color: #2d7d32;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #48bb78;
        }

        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.8);
            animation: fadeIn 0.3s ease;
        }

        .modal-content {
            position: relative;
            margin: 5% auto;
            max-width: 90%;
            max-height: 90%;
            background: white;
            border-radius: 12px;
            padding: 20px;
            animation: slideIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .modal img {
            max-width: 100%;
            max-height: 70vh;
            object-fit: contain;
            border-radius: 8px;
        }

        .close {
            position: absolute;
            right: 15px;
            top: 15px;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            color: #a0aec0;
            transition: color 0.3s ease;
        }

        .close:hover {
            color: #4a5568;
        }

        .download-btn {
            background: #48bb78;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 15px;
            font-size: 14px;
            transition: background 0.3s ease;
        }

        .download-btn:hover {
            background: #38a169;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🎨 AI 图像生成器</h1>
            <p>基于 Cloudflare Workers AI 和 FLUX.1 [schnell] 模型</p>
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <!-- Input Panel -->
            <div class="input-panel">
                <h3>📝 创建您的图像</h3>
                
                <div id="error-message" class="error-message" style="display: none;"></div>
                <div id="success-message" class="success-message" style="display: none;"></div>

                <form id="generate-form">
                    <div class="form-group">
                        <label for="prompt">图像描述</label>
                        <textarea 
                            id="prompt" 
                            class="prompt-input" 
                            placeholder="描述您想要生成的图像，例如：一只在彩虹桥上行走的可爱橘猫，水彩画风格，高质量，8k分辨率"
                            maxlength="2048"
                            required
                        ></textarea>
                        <div id="char-counter" class="char-counter">0 / 2048</div>
                    </div>

                    <div class="form-group">
                        <label for="steps">扩散步数 (影响质量和速度)</label>
                        <div class="steps-group">
                            <input 
                                type="range" 
                                id="steps" 
                                class="steps-input" 
                                min="1" 
                                max="8" 
                                value="4"
                            >
                            <div id="steps-display" class="steps-display">4 步</div>
                        </div>
                        <small style="color: #718096;">更多步数 = 更高质量，但生成时间更长</small>
                    </div>

                    <div class="form-group">
                        <label for="numImages">生成图片数量</label>
                        <div class="steps-group">
                            <input 
                                type="range" 
                                id="numImages" 
                                class="steps-input" 
                                min="1" 
                                max="4" 
                                value="1"
                            >
                            <div id="numImages-display" class="steps-display">1 张</div>
                        </div>
                        <small style="color: #718096;">一次生成多张图片，每张都将保存到云存储</small>
                    </div>

                    <button type="submit" id="generate-btn" class="generate-btn">
                        <span class="loading-spinner" id="loading-spinner"></span>
                        <span id="btn-text">🚀 生成图像</span>
                    </button>
                </form>
            </div>

            <!-- Result Panel -->
            <div class="result-panel">
                <h3>🖼️ 生成结果</h3>
                <div id="result-container">
                    <div class="result-placeholder">
                        点击"生成图像"开始创作
                    </div>
                </div>
            </div>
        </div>

        <!-- History Section -->
        <div class="history-section">
            <h3>📚 生成历史</h3>
            <div id="history-grid" class="history-grid">
                <!-- History items will be loaded here -->
            </div>
        </div>
    </div>

    <!-- Modal for full-size image view -->
    <div id="image-modal" class="modal">
        <div class="modal-content">
            <span class="close">&times;</span>
            <img id="modal-image" src="" alt="Full size image">
            <div id="modal-info"></div>
            <button id="download-btn" class="download-btn">📥 下载图像</button>
        </div>
    </div>

    <script>
        // DOM Elements
        const promptInput = document.getElementById('prompt');
        const charCounter = document.getElementById('char-counter');
        const stepsInput = document.getElementById('steps');
        const stepsDisplay = document.getElementById('steps-display');
        const numImagesInput = document.getElementById('numImages');
        const numImagesDisplay = document.getElementById('numImages-display');
        const generateForm = document.getElementById('generate-form');
        const generateBtn = document.getElementById('generate-btn');
        const loadingSpinner = document.getElementById('loading-spinner');
        const btnText = document.getElementById('btn-text');
        const resultContainer = document.getElementById('result-container');
        const historyGrid = document.getElementById('history-grid');
        const errorMessage = document.getElementById('error-message');
        const successMessage = document.getElementById('success-message');
        const imageModal = document.getElementById('image-modal');
        const modalImage = document.getElementById('modal-image');
        const modalInfo = document.getElementById('modal-info');
        const downloadBtn = document.getElementById('download-btn');
        const closeModal = document.querySelector('.close');

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            loadHistory();
            updateCharCounter();
            updateStepsDisplay();
            updateNumImagesDisplay();
        });

        // Character counter
        promptInput.addEventListener('input', updateCharCounter);

        function updateCharCounter() {
            const length = promptInput.value.length;
            charCounter.textContent = \`\${length} / 2048\`;
            charCounter.classList.toggle('warning', length > 1800);
        }

        // Steps slider
        stepsInput.addEventListener('input', updateStepsDisplay);

        function updateStepsDisplay() {
            const value = stepsInput.value;
            stepsDisplay.textContent = \`\${value} 步\`;
        }

        // Number of images slider
        numImagesInput.addEventListener('input', updateNumImagesDisplay);

        function updateNumImagesDisplay() {
            const value = numImagesInput.value;
            numImagesDisplay.textContent = \`\${value} 张\`;
        }

        // Form submission
        generateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await generateImage();
        });

        async function generateImage() {
            const prompt = promptInput.value.trim();
            const steps = parseInt(stepsInput.value);
            const numImages = parseInt(numImagesInput.value);

            if (!prompt) {
                showError('请输入图像描述');
                return;
            }

            if (prompt.length > 2048) {
                showError('图像描述不能超过2048个字符');
                return;
            }

            setGenerating(true);
            hideMessages();

            try {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt, steps, numImages })
                });

                const data = await response.json();

                if (data.success) {
                    displayResults(data);
                    showSuccess(\`成功生成了 \${data.generatedCount} 张图像并保存到云存储！\`);
                    loadHistory(); // Refresh history
                } else {
                    showError(data.error || '生成失败');
                }
            } catch (error) {
                console.error('Generate error:', error);
                showError('网络错误，请稍后重试');
            } finally {
                setGenerating(false);
            }
        }

        function setGenerating(isGenerating) {
            generateBtn.disabled = isGenerating;
            loadingSpinner.style.display = isGenerating ? 'inline-block' : 'none';
            btnText.textContent = isGenerating ? '生成中...' : '🚀 生成图像';
        }

        function displayResults(data) {
            if (data.images && data.images.length > 0) {
                const imagesHtml = data.images.map((image, index) => \`
                    <div class="image-item" onclick="openModal('\${image.base64}', '\${escapeHtml(data.prompt)}', \${data.steps}, \${data.timestamp}, \${index + 1})">
                        <img src="\${image.base64}" alt="Generated image \${index + 1}">
                        <div class="image-index">\${index + 1}/\${data.images.length}</div>
                        <button class="download-btn" onclick="event.stopPropagation(); downloadImage('\${image.base64}', 'generated-image-\${data.timestamp}-\${index + 1}.png')">📥</button>
                    </div>
                \`).join('');

                resultContainer.innerHTML = \`
                    <div class="images-grid">
                        \${imagesHtml}
                    </div>
                    <div class="result-info">
                        <div><strong>提示词:</strong> \${escapeHtml(data.prompt)}</div>
                        <div><strong>步数:</strong> \${data.steps}</div>
                        <div><strong>生成数量:</strong> \${data.generatedCount} / \${data.numImages} 张</div>
                        <div><strong>生成时间:</strong> \${new Date(data.timestamp).toLocaleString('zh-CN')}</div>
                        <div><strong>云存储:</strong> 已保存到 R2 存储桶</div>
                    </div>
                \`;
            } else {
                showError('未能生成任何图像');
            }
        }

        // Download function
        function downloadImage(base64Data, filename) {
            const link = document.createElement('a');
            link.href = base64Data;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        async function loadHistory() {
            try {
                const response = await fetch('/api/history');
                const history = await response.json();
                
                if (Array.isArray(history) && history.length > 0) {
                    historyGrid.innerHTML = history.map(item => \`
                        <div class="history-item" onclick="openModal('data:image/png;base64,\${item.imageData}', '\${escapeHtml(item.prompt)}', \${item.steps}, \${item.timestamp})">
                            <img src="data:image/png;base64,\${item.imageData}" alt="Generated image">
                            <div class="history-item-info">
                                <div class="history-item-prompt">\${escapeHtml(item.prompt)}</div>
                                <div class="history-item-meta">步数: \${item.steps} | \${new Date(item.timestamp).toLocaleDateString('zh-CN')}</div>
                            </div>
                        </div>
                    \`).join('');
                } else {
                    historyGrid.innerHTML = '<p style="text-align: center; color: #a0aec0; grid-column: 1 / -1;">暂无生成历史</p>';
                }
            } catch (error) {
                console.error('Load history error:', error);
                historyGrid.innerHTML = '<p style="text-align: center; color: #f56565; grid-column: 1 / -1;">加载历史失败</p>';
            }
        }

        function openModal(imageUrl, prompt, steps, timestamp, imageIndex = null) {
            modalImage.src = imageUrl;
            modalInfo.innerHTML = \`
                <div style="margin-top: 15px;">
                    <div><strong>提示词:</strong> \${escapeHtml(prompt)}</div>
                    <div><strong>步数:</strong> \${steps}</div>
                    \${imageIndex ? \`<div><strong>图片:</strong> 第 \${imageIndex} 张</div>\` : ''}
                    <div><strong>生成时间:</strong> \${new Date(timestamp).toLocaleString('zh-CN')}</div>
                </div>
            \`;
            const filename = imageIndex ? \`ai-image-\${timestamp}-\${imageIndex}.png\` : \`ai-image-\${timestamp}.png\`;
            downloadBtn.onclick = () => downloadImage(imageUrl, filename);
            imageModal.style.display = 'block';
        }

        function downloadImage(imageUrl, filename) {
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        }

        function showSuccess(message) {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
        }

        function hideMessages() {
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';
        }

        // Modal functionality
        closeModal.onclick = () => {
            imageModal.style.display = 'none';
        };

        window.onclick = (event) => {
            if (event.target === imageModal) {
                imageModal.style.display = 'none';
            }
        };

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                generateImage();
            }
            if (e.key === 'Escape') {
                imageModal.style.display = 'none';
            }
        });
    </script>
</body>
</html>`;
}
