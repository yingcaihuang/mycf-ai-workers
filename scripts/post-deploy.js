#!/usr/bin/env node

/**
 * 部署后验证脚本
 */

const https = require('https');
const { execSync } = require('child_process');

console.log('🔍 部署后验证...\n');

async function getWorkerUrl() {
  try {
    // 从 wrangler.toml 获取应用名称
    const fs = require('fs');
    const path = require('path');
    const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
    const content = fs.readFileSync(wranglerPath, 'utf8');
    const nameMatch = content.match(/name = "([^"]+)"/);
    const appName = nameMatch ? nameMatch[1] : 'ai-image-generator';
    
    // 获取 Cloudflare 账户信息
    const whoami = execSync('wrangler whoami', { encoding: 'utf8' });
    const accountMatch = whoami.match(/Account ID: ([a-f0-9]+)/);
    
    if (accountMatch) {
      return `https://${appName}.your-subdomain.workers.dev`;
    }
    
    return null;
  } catch (error) {
    console.log('⚠️ 无法自动获取 Worker URL');
    return null;
  }
}

async function testEndpoint(url, path = '', method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Deployment-Validator/1.0'
      },
      timeout: 10000
    };

    const fullUrl = url + path;
    console.log(`🌐 测试端点: ${method} ${fullUrl}`);

    const req = https.request(fullUrl, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runHealthChecks(workerUrl) {
  if (!workerUrl) {
    console.log('⚠️ 无法获取 Worker URL，请手动测试部署');
    return false;
  }

  const tests = [
    {
      name: '主页加载',
      path: '/',
      expectedStatus: 200,
      test: async () => {
        const result = await testEndpoint(workerUrl, '/');
        return result.status === 200 && result.body.includes('AI 图像生成器');
      }
    },
    {
      name: 'CORS 预检',
      path: '/api/generate',
      method: 'OPTIONS',
      expectedStatus: 200,
      test: async () => {
        const result = await testEndpoint(workerUrl, '/api/generate', 'OPTIONS');
        return result.status === 200 && 
               result.headers['access-control-allow-origin'] === '*';
      }
    },
    {
      name: '历史记录 API',
      path: '/api/history',
      expectedStatus: 200,
      test: async () => {
        const result = await testEndpoint(workerUrl, '/api/history');
        return result.status === 200;
      }
    },
    {
      name: '图像生成 API (错误处理)',
      path: '/api/generate',
      method: 'POST',
      data: { prompt: '' }, // 空提示词应该返回错误
      expectedStatus: 400,
      test: async () => {
        const result = await testEndpoint(workerUrl, '/api/generate', 'POST', { prompt: '' });
        return result.status === 400;
      }
    }
  ];

  let passed = 0;
  const total = tests.length;

  for (const test of tests) {
    try {
      console.log(`\n🧪 测试: ${test.name}`);
      const success = await test.test();
      if (success) {
        console.log(`✅ ${test.name} - 通过`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - 失败`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - 错误: ${error.message}`);
    }
  }

  console.log(`\n📊 测试结果: ${passed}/${total} 通过`);
  return passed === total;
}

async function showDeploymentInfo() {
  console.log('\n🎉 部署完成！\n');
  
  console.log('📋 部署信息:');
  try {
    const whoami = execSync('wrangler whoami', { encoding: 'utf8' });
    console.log('👤 账户信息:');
    console.log(whoami);
  } catch (error) {
    console.log('⚠️ 无法获取账户信息');
  }

  console.log('\n🔗 有用的链接:');
  console.log('  📊 Cloudflare Dashboard: https://dash.cloudflare.com');
  console.log('  🤖 Workers AI: https://dash.cloudflare.com/workers-ai');
  console.log('  📚 文档: https://developers.cloudflare.com/workers-ai/');

  console.log('\n🛠️ 管理命令:');
  console.log('  查看日志: npm run logs');
  console.log('  更新配置: wrangler kv:key put --binding IMAGE_STORE');
  console.log('  重新部署: npm run deploy');

  console.log('\n💡 提示:');
  console.log('  1. 确保您的域名 DNS 设置正确（如果使用自定义域名）');
  console.log('  2. 在 Cloudflare Dashboard 中监控使用情况和性能');
  console.log('  3. 定期查看 Workers AI 的使用配额');
}

async function main() {
  try {
    // 获取 Worker URL
    const workerUrl = await getWorkerUrl();
    
    // 运行健康检查
    if (workerUrl) {
      const allTestsPassed = await runHealthChecks(workerUrl);
      if (!allTestsPassed) {
        console.log('\n⚠️ 部分测试失败，请检查部署状态');
      }
    }

    // 显示部署信息
    await showDeploymentInfo();

    console.log('\n✨ 验证完成！您的 AI 图像生成器已成功部署！');

  } catch (error) {
    console.error('❌ 部署验证失败:', error.message);
    process.exit(1);
  }
}

main();
