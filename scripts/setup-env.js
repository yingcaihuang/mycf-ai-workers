#!/usr/bin/env node

/**
 * 环境设置和验证脚本
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🌍 设置部署环境...\n');

function checkWranglerAuth() {
  try {
    const output = execSync('wrangler whoami', { encoding: 'utf8', stdio: 'pipe' });
    console.log('✅ Wrangler 认证状态:', output.trim());
    return true;
  } catch (error) {
    console.log('❌ Wrangler 未认证，请运行: wrangler auth login');
    return false;
  }
}

function checkWorkersAI() {
  console.log('🤖 检查 Workers AI 可用性...');
  // 这里可以添加 Workers AI 的检查逻辑
  console.log('ℹ️ 请确保您的 Cloudflare 账户已启用 Workers AI');
  console.log('   访问: https://dash.cloudflare.com/workers-ai');
}

function validateConfig() {
  console.log('🔧 验证配置文件...');
  
  const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    console.log('❌ wrangler.toml 不存在');
    return false;
  }

  const content = fs.readFileSync(wranglerPath, 'utf8');
  
  // 检查关键配置
  const checks = [
    { pattern: /\[ai\]/, name: 'AI binding' },
    { pattern: /binding = "AI"/, name: 'AI binding 名称' },
    { pattern: /\[\[kv_namespaces\]\]/, name: 'KV 命名空间' },
    { pattern: /binding = "IMAGE_STORE"/, name: 'KV binding 名称' }
  ];

  let allValid = true;
  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name} 配置缺失`);
      allValid = false;
    }
  });

  if (content.includes('your-kv-namespace-id')) {
    console.log('⚠️ KV 命名空间 ID 需要配置，运行: npm run setup:kv');
    allValid = false;
  } else {
    console.log('✅ KV 命名空间 ID 已配置');
  }

  return allValid;
}

function setupEnvironments() {
  console.log('\n📋 环境配置清单:');
  
  const environments = [
    { name: 'development', desc: '本地开发环境' },
    { name: 'staging', desc: '测试环境' },
    { name: 'production', desc: '生产环境' }
  ];

  environments.forEach(env => {
    console.log(`  ${env.name}: ${env.desc}`);
  });

  console.log('\n🚀 部署命令:');
  console.log('  npm run dev              # 本地开发');
  console.log('  npm run deploy:staging   # 部署到测试环境');
  console.log('  npm run deploy           # 部署到生产环境');
}

function createEnvFiles() {
  console.log('\n📄 创建环境配置文件...');
  
  const envTemplate = `# Cloudflare Workers AI 图像生成器环境配置
# 这个文件用于本地开发时的环境变量配置

# 应用设置
APP_NAME=AI Image Generator
ENVIRONMENT=development

# AI 模型配置
MODEL_NAME=@cf/black-forest-labs/flux-1-schnell
MAX_PROMPT_LENGTH=2048
MAX_STEPS=8
DEFAULT_STEPS=4

# 功能开关
ENABLE_HISTORY=true
ENABLE_ANALYTICS=false
ENABLE_RATE_LIMITING=true

# 开发配置
DEBUG=true
LOG_LEVEL=info
`;

  const envPath = path.join(__dirname, '..', '.env.example');
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ 创建 .env.example 文件');

  // 创建 .env 文件（如果不存在）
  const localEnvPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(localEnvPath)) {
    fs.writeFileSync(localEnvPath, envTemplate);
    console.log('✅ 创建 .env 文件');
  } else {
    console.log('ℹ️ .env 文件已存在，跳过创建');
  }
}

async function main() {
  // 检查认证
  const isAuthed = checkWranglerAuth();
  if (!isAuthed) {
    process.exit(1);
  }

  // 检查 Workers AI
  checkWorkersAI();

  // 验证配置
  const configValid = validateConfig();
  
  // 设置环境
  setupEnvironments();
  
  // 创建环境文件
  createEnvFiles();

  console.log('\n🎯 环境设置完成！');
  
  if (!configValid) {
    console.log('\n⚠️ 发现配置问题，请先解决后再部署');
    process.exit(1);
  }

  console.log('\n✨ 一切就绪，可以开始开发了！');
}

main().catch(error => {
  console.error('❌ 环境设置失败:', error.message);
  process.exit(1);
});
