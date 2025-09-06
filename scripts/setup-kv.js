#!/usr/bin/env node

/**
 * 自动设置 KV 命名空间的脚本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🗄️ 自动设置 KV 命名空间...\n');

async function setupKV() {
  try {
    // 检查是否已登录 Wrangler
    console.log('🔐 检查 Wrangler 认证状态...');
    try {
      execSync('wrangler whoami', { stdio: 'pipe' });
      console.log('✅ Wrangler 已认证');
    } catch (error) {
      console.log('❌ 请先登录 Wrangler:');
      console.log('   wrangler auth login');
      process.exit(1);
    }

    // 创建生产环境 KV 命名空间
    console.log('\n📦 创建生产环境 KV 命名空间...');
    const prodOutput = execSync('wrangler kv:namespace create "IMAGE_STORE"', { 
      encoding: 'utf8' 
    });
    console.log(prodOutput);

    // 创建预览环境 KV 命名空间
    console.log('📦 创建预览环境 KV 命名空间...');
    const previewOutput = execSync('wrangler kv:namespace create "IMAGE_STORE" --preview', { 
      encoding: 'utf8' 
    });
    console.log(previewOutput);

    // 解析输出获取 ID
    const prodMatch = prodOutput.match(/id = "([^"]+)"/);
    const previewMatch = previewOutput.match(/id = "([^"]+)"/);

    if (!prodMatch || !previewMatch) {
      console.log('⚠️ 无法自动解析 KV 命名空间 ID，请手动更新 wrangler.toml');
      return;
    }

    const prodId = prodMatch[1];
    const previewId = previewMatch[1];

    console.log(`\n📝 更新 wrangler.toml 配置...`);
    console.log(`   生产环境 ID: ${prodId}`);
    console.log(`   预览环境 ID: ${previewId}`);

    // 更新 wrangler.toml 文件
    const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
    let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
    
    wranglerContent = wranglerContent
      .replace(/id = "your-kv-namespace-id"/, `id = "${prodId}"`)
      .replace(/preview_id = "your-preview-kv-namespace-id"/, `preview_id = "${previewId}"`);
    
    fs.writeFileSync(wranglerPath, wranglerContent);

    console.log('✅ KV 命名空间设置完成！');
    console.log('\n🎯 接下来可以运行:');
    console.log('   npm run dev     # 本地开发');
    console.log('   npm run deploy  # 部署到生产环境');

  } catch (error) {
    console.error('❌ KV 设置失败:', error.message);
    process.exit(1);
  }
}

// 检查是否需要设置
const wranglerPath = path.join(__dirname, '..', 'wrangler.toml');
if (fs.existsSync(wranglerPath)) {
  const content = fs.readFileSync(wranglerPath, 'utf8');
  if (content.includes('your-kv-namespace-id')) {
    setupKV();
  } else {
    console.log('✅ KV 命名空间已配置');
  }
} else {
  console.log('❌ wrangler.toml 文件不存在');
  process.exit(1);
}
