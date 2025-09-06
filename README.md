# Cloudflare Workers AI 图像生成器

基于 Cloudflare Workers AI 和 FLUX.1 [schnell] 模型的智能图像生成应用。

## ✨ 功能特性

- 🎨 **智能图像生成**: 使用 FLUX.1 [schnell] 模型，基于文本描述生成高质量图像
- 🎛️ **参数控制**: 可调节扩散步数 (1-8步)，平衡质量与速度
- 📱 **响应式设计**: 完美适配桌面端和移动端
- 📚 **历史记录**: 自动保存生成历史，支持查看和下载
- 🚀 **极速体验**: 基于 Cloudflare Workers 的全球 CDN 加速
- 💾 **智能存储**: 使用 KV 存储保存用户历史记录

![AI图像生成器网站截图](https://raw.githubusercontent.com/yingcaihuang/mycf-ai-workers/refs/heads/main/screencapture-ai-image-generator-nfr-gcr-eastasia-workers-dev-2025-09-06-19_11_21.png)

## 🛠️ 技术栈

- **后端**: Cloudflare Workers
- **AI 模型**: FLUX.1 [schnell] (12B 参数的图像生成模型)
- **存储**: Cloudflare KV
- **前端**: 原生 HTML/CSS/JavaScript
- **部署**: Wrangler CLI

## 🚀 快速开始

### 前置要求

- Node.js 18+
- Cloudflare 账户
- Wrangler CLI

### 1. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 2. 配置 Cloudflare

1. 创建 KV 命名空间:
\`\`\`bash
wrangler kv:namespace create "IMAGE_STORE"
wrangler kv:namespace create "IMAGE_STORE" --preview
\`\`\`

2. 更新 \`wrangler.toml\` 中的 KV 命名空间 ID

3. 确保您的 Cloudflare 账户已启用 Workers AI

### 3. 本地开发

\`\`\`bash
npm run dev
\`\`\`

应用将在 `http://localhost:8787` 启动

### 4. 部署到生产环境

\`\`\`bash
npm run deploy
\`\`\`

## 📖 API 文档

### POST /api/generate

生成图像

**请求体**:
\`\`\`json
{
  "prompt": "图像描述文字 (1-2048字符)",
  "steps": 4
}
\`\`\`

**响应**:
\`\`\`json
{
  "success": true,
  "image": "base64编码的图像数据",
  "timestamp": 1234567890,
  "prompt": "用户输入的提示词",
  "steps": 4
}
\`\`\`

### GET /api/history

获取生成历史

**响应**:
\`\`\`json
[
  {
    "prompt": "提示词",
    "steps": 4,
    "timestamp": 1234567890,
    "imageData": "base64编码的图像数据"
  }
]
\`\`\`

## 🎨 界面特性

### 主要组件

1. **输入面板**
   - 多行文本输入框，支持最多 2048 字符
   - 实时字符计数器
   - 扩散步数滑块 (1-8步)
   - 生成按钮带加载状态

2. **结果展示**
   - 高质量图像预览
   - 点击放大查看
   - 生成参数信息显示

3. **历史记录**
   - 网格布局展示历史生成
   - 悬停效果和动画
   - 点击查看大图和下载

4. **模态框**
   - 全屏图像查看
   - 详细信息展示
   - 一键下载功能

### 设计亮点

- 🎨 **现代渐变背景**: 紫色系渐变营造科技感
- 📱 **完全响应式**: 移动端优化的栅格布局
- 🎯 **直观交互**: 清晰的视觉反馈和状态指示
- ⚡ **流畅动画**: 微妙的过渡效果提升用户体验
- 🔧 **快捷键支持**: Ctrl+Enter 快速生成，ESC 关闭模态框

## 🎛️ 使用说明

1. **输入描述**: 在文本框中输入您想要生成的图像描述
2. **调整参数**: 使用滑块调整扩散步数 (步数越多，质量越高，但时间越长)
3. **生成图像**: 点击生成按钮或使用 Ctrl+Enter 快捷键
4. **查看结果**: 生成完成后，图像将显示在右侧面板
5. **保存图像**: 点击图像可放大查看，并支持下载
6. **查看历史**: 所有生成的图像都会保存在历史记录中

## 💡 最佳实践

### 提示词建议

- 📝 **详细描述**: 包含主体、风格、环境、光线等信息
- 🎨 **风格指定**: 如"水彩画"、"油画"、"摄影"等
- 📐 **质量关键词**: 如"高质量"、"8K分辨率"、"专业摄影"等
- 🌈 **情感表达**: 加入情感和氛围描述

### 参数调优

- **快速预览**: 使用 1-4 步进行快速预览
- **高质量输出**: 使用 6-8 步获得最佳质量
- **平衡选择**: 4-6 步提供质量和速度的良好平衡

## 🔧 配置说明

### 环境变量

- \`ENVIRONMENT\`: 运行环境 (development/production)

### KV 存储

- \`IMAGE_STORE\`: 存储用户生成历史
- 过期时间: 7天自动清理

### 成本控制

FLUX.1 [schnell] 定价:

- $0.000053 每个 512x512 瓦片
- $0.00011 每步

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [FLUX.1 by Black Forest Labs](https://blackforestlabs.ai/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## 💻 技术支持

构建于 ❤️ 与 Cloudflare Workers
