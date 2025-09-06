#!/usr/bin/env node

/**
 * 快速修复依赖问题的脚本
 * 解决 workerd 平台不匹配等常见问题
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logStep(message) {
  log(`🔄 ${message}`, 'cyan');
}

async function main() {
  console.log('🔧 依赖修复工具\n');
  
  // 检查是否在正确的目录
  if (!fs.existsSync('package.json')) {
    logError('未找到 package.json，请在项目根目录运行此脚本');
    process.exit(1);
  }
  
  try {
    // 步骤 1: 清理现有依赖
    logStep('清理现有依赖...');
    
    const itemsToClean = ['node_modules', 'package-lock.json', '.wrangler'];
    
    for (const item of itemsToClean) {
      if (fs.existsSync(item)) {
        logInfo(`删除: ${item}`);
        execSync(`rm -rf ${item}`, { stdio: 'inherit' });
      }
    }
    
    logSuccess('清理完成');
    
    // 步骤 2: 重新安装依赖
    logStep('重新安装依赖...');
    
    // 使用 --force 强制重新安装，避免平台问题
    execSync('npm install --force', { stdio: 'inherit' });
    
    logSuccess('依赖安装完成');
    
    // 步骤 3: 验证关键依赖
    logStep('验证关键依赖...');
    
    const criticalDeps = [
      '@cloudflare/workers-types',
      'wrangler'
    ];
    
    let allInstalled = true;
    
    for (const dep of criticalDeps) {
      const depPath = path.join('node_modules', dep);
      if (fs.existsSync(depPath)) {
        logSuccess(`${dep} 安装成功`);
      } else {
        logError(`${dep} 安装失败`);
        allInstalled = false;
      }
    }
    
    // 步骤 4: 测试 Wrangler
    logStep('测试 Wrangler...');
    
    try {
      const version = execSync('npx wrangler --version', { encoding: 'utf8' });
      logSuccess(`Wrangler 工作正常: ${version.trim()}`);
    } catch (error) {
      logError('Wrangler 仍有问题，尝试全局安装...');
      
      try {
        execSync('npm install -g wrangler', { stdio: 'inherit' });
        logSuccess('全局 Wrangler 安装完成');
      } catch (globalError) {
        logError('全局安装也失败，请手动检查');
      }
    }
    
    // 步骤 5: 运行基础检查
    logStep('运行基础检查...');
    
    try {
      execSync('npm run environment-check', { stdio: 'inherit' });
    } catch (error) {
      logWarning('环境检查仍有问题，但基础依赖已修复');
    }
    
    if (allInstalled) {
      logSuccess('🎉 依赖修复完成！');
      
      console.log('\n📋 下一步建议:');
      console.log('1. 运行 npm run environment-check 再次检查环境');
      console.log('2. 运行 npm run init 完成项目初始化');
      console.log('3. 运行 npm run dev 启动本地开发');
    } else {
      logWarning('⚠️  部分依赖仍有问题，可能需要手动处理');
    }
    
  } catch (error) {
    logError(`修复失败: ${error.message}`);
    
    console.log('\n🔧 手动修复建议:');
    console.log('1. 确保 Node.js 版本 >= 18');
    console.log('2. 清空 npm 缓存: npm cache clean --force');
    console.log('3. 删除 node_modules 后重新安装');
    console.log('4. 考虑使用 yarn 代替 npm');
    
    process.exit(1);
  }
}

main();
