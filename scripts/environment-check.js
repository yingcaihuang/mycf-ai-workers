#!/usr/bin/env node

/**
 * 环境设置和依赖检查脚本
 * 检查部署前的所有必要条件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
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

// 检查 Node.js 版本
function checkNodeVersion() {
  logStep('检查 Node.js 版本...');
  
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  
  if (majorVersion >= 18) {
    logSuccess(`Node.js 版本正常: ${nodeVersion}`);
    return true;
  } else {
    logError(`Node.js 版本过低: ${nodeVersion}，需要 18.0.0 或更高版本`);
    return false;
  }
}

// 检查 npm 版本
function checkNpmVersion() {
  logStep('检查 npm 版本...');
  
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    const majorVersion = parseInt(npmVersion.split('.')[0]);
    
    if (majorVersion >= 9) {
      logSuccess(`npm 版本正常: ${npmVersion}`);
      return true;
    } else {
      logWarning(`npm 版本较低: ${npmVersion}，建议升级到 9.0.0 或更高版本`);
      return true; // 不是致命错误
    }
  } catch (error) {
    logError('npm 未安装或无法访问');
    return false;
  }
}

// 检查 Wrangler CLI
function checkWrangler() {
  logStep('检查 Wrangler CLI...');
  
  // 先检查本地安装的 wrangler
  const checkCommands = [
    'npx wrangler --version',  // 本地安装
    'wrangler --version'       // 全局安装
  ];
  
  let wranglerFound = false;
  let wranglerVersion = '';
  
  for (const cmd of checkCommands) {
    try {
      wranglerVersion = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
      wranglerFound = true;
      logSuccess(`Wrangler 可用: ${wranglerVersion} (${cmd.includes('npx') ? '本地安装' : '全局安装'})`);
      break;
    } catch (error) {
      // 继续尝试下一个命令
    }
  }
  
  if (!wranglerFound) {
    logError('Wrangler CLI 未安装');
    logInfo('安装选项:');
    logInfo('  • 本地安装: npm install wrangler');
    logInfo('  • 全局安装: npm install -g wrangler');
    return false;
  }
  
  // 检查登录状态 - 使用 npx 优先
  try {
    const wranglerCmd = wranglerFound && wranglerVersion ? 'npx wrangler' : 'wrangler';
    const whoami = execSync(`${wranglerCmd} whoami`, { encoding: 'utf8', stdio: 'pipe' }).trim();
    logSuccess(`已登录 Cloudflare: ${whoami}`);
    return true;
  } catch (error) {
    logWarning('未登录 Cloudflare，部署时需要先登录');
    logInfo('运行: npx wrangler auth login 或 wrangler auth login');
    return true; // 不是致命错误，部署脚本会处理
  }
}

// 检查必需文件
function checkRequiredFiles() {
  logStep('检查必需文件...');
  
  const requiredFiles = [
    { path: 'package.json', description: 'Package 配置文件' },
    { path: 'wrangler.toml', description: 'Wrangler 配置文件' },
    { path: 'src/index.js', description: 'Worker 主文件' },
    { path: 'README.md', description: '项目文档' }
  ];
  
  let allExists = true;
  
  for (const file of requiredFiles) {
    if (fs.existsSync(file.path)) {
      logSuccess(`${file.description}: ${file.path}`);
    } else {
      logError(`缺失文件: ${file.path} (${file.description})`);
      allExists = false;
    }
  }
  
  return allExists;
}

// 检查 package.json 配置
function checkPackageJson() {
  logStep('检查 package.json 配置...');
  
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // 检查脚本
    const requiredScripts = ['dev', 'deploy', 'lint'];
    let scriptIssues = 0;
    
    for (const script of requiredScripts) {
      if (packageJson.scripts && packageJson.scripts[script]) {
        logSuccess(`脚本配置正常: ${script}`);
      } else {
        logWarning(`缺失脚本: ${script}`);
        scriptIssues++;
      }
    }
    
    // 检查依赖
    const requiredDeps = ['@cloudflare/workers-types'];
    let depIssues = 0;
    
    for (const dep of requiredDeps) {
      const inDeps = packageJson.dependencies && packageJson.dependencies[dep];
      const inDevDeps = packageJson.devDependencies && packageJson.devDependencies[dep];
      
      if (inDeps || inDevDeps) {
        logSuccess(`依赖配置正常: ${dep}`);
      } else {
        logWarning(`缺失依赖: ${dep}`);
        depIssues++;
      }
    }
    
    return scriptIssues === 0 && depIssues === 0;
  } catch (error) {
    logError(`读取 package.json 失败: ${error.message}`);
    return false;
  }
}

// 检查 wrangler.toml 配置
function checkWranglerConfig() {
  logStep('检查 wrangler.toml 配置...');
  
  try {
    const wranglerPath = path.join(process.cwd(), 'wrangler.toml');
    const content = fs.readFileSync(wranglerPath, 'utf8');
    
    // 检查必要配置
    const checks = [
      { pattern: /name\s*=\s*"[^"]+"/,  name: 'Worker 名称' },
      { pattern: /main\s*=\s*"[^"]+"/,  name: '主入口文件' },
      { pattern: /compatibility_date\s*=\s*"[^"]+"/,  name: '兼容性日期' },
      { pattern: /\[ai\]/,  name: 'AI 绑定配置' },
      { pattern: /binding\s*=\s*"AI"/,  name: 'AI 绑定名称' }
    ];
    
    let allPassed = true;
    
    for (const check of checks) {
      if (check.pattern.test(content)) {
        logSuccess(`配置正常: ${check.name}`);
      } else {
        logError(`配置缺失: ${check.name}`);
        allPassed = false;
      }
    }
    
    // 检查 KV 命名空间配置
    if (content.includes('your-kv-namespace-id')) {
      logWarning('KV 命名空间尚未配置（使用占位符 ID）');
      logInfo('运行: npm run setup:kv 自动配置');
    } else {
      logSuccess('KV 命名空间配置正常');
    }
    
    return allPassed;
  } catch (error) {
    logError(`读取 wrangler.toml 失败: ${error.message}`);
    return false;
  }
}

// 检查依赖安装状态
function checkDependencies() {
  logStep('检查依赖安装状态...');
  
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    logWarning('依赖未安装');
    logInfo('运行: npm install');
    return false;
  }
  
  // 检查关键依赖
  const criticalDeps = [
    '@cloudflare/workers-types',
    'wrangler'
  ];
  
  let allInstalled = true;
  let installedCount = 0;
  
  for (const dep of criticalDeps) {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      logSuccess(`依赖已安装: ${dep}`);
      installedCount++;
    } else {
      logWarning(`依赖未安装: ${dep}`);
      allInstalled = false;
    }
  }
  
  // 检查 package-lock.json 或 yarn.lock 是否存在
  const lockFiles = ['package-lock.json', 'yarn.lock'];
  const hasLockFile = lockFiles.some(file => fs.existsSync(path.join(process.cwd(), file)));
  
  if (hasLockFile) {
    logSuccess('发现锁定文件，依赖版本固定');
  } else {
    logInfo('建议生成 package-lock.json 锁定依赖版本');
  }
  
  // 如果部分依赖已安装，认为基本可用
  if (installedCount > 0) {
    if (!allInstalled) {
      logWarning('部分依赖未安装，建议运行 npm install');
    }
    return true;
  }
  
  return allInstalled;
}

// 检查 TypeScript 配置（如果存在）
function checkTypeScriptConfig() {
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  
  if (fs.existsSync(tsconfigPath)) {
    logStep('检查 TypeScript 配置...');
    
    try {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      
      // 检查基础配置
      if (tsconfig.compilerOptions) {
        logSuccess('TypeScript 配置存在');
        
        // 检查类型检查 - 优先使用 npx
        const tscCommands = ['npx tsc --noEmit', 'tsc --noEmit'];
        
        for (const cmd of tscCommands) {
          try {
            execSync(cmd, { stdio: 'pipe' });
            logSuccess('TypeScript 类型检查通过');
            return true;
          } catch (error) {
            // 继续尝试下一个命令
          }
        }
        
        logWarning('TypeScript 类型检查发现问题（可能是工具未安装）');
        logInfo('建议: npm install typescript --save-dev');
        return false;
      } else {
        logWarning('TypeScript 配置不完整');
        return false;
      }
    } catch (error) {
      logError(`TypeScript 配置无效: ${error.message}`);
      return false;
    }
  } else {
    logInfo('未使用 TypeScript（可选）');
    return true;
  }
}

// 检查代码质量工具
function checkLinting() {
  logStep('检查代码质量工具...');
  
  const eslintConfigPath = path.join(process.cwd(), '.eslintrc.json');
  
  if (fs.existsSync(eslintConfigPath)) {
    logSuccess('ESLint 配置存在');
    
    // 尝试不同的 lint 命令
    const lintCommands = [
      'npm run lint:check',
      'npx eslint src/ --ext .js,.ts',
      'eslint src/ --ext .js,.ts'
    ];
    
    for (const cmd of lintCommands) {
      try {
        execSync(cmd, { stdio: 'pipe' });
        logSuccess('代码风格检查通过');
        return true;
      } catch (error) {
        // 继续尝试下一个命令
      }
    }
    
    logWarning('代码风格检查发现问题');
    logInfo('尝试修复: npm run lint:fix 或 npx eslint src/ --ext .js,.ts --fix');
    return false;
  } else {
    logInfo('未配置 ESLint（可选）');
    return true;
  }
}

// 生成环境报告
function generateReport(results) {
  console.log('\n📊 环境检查报告:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const categories = [
    { name: '系统环境', checks: ['nodeVersion', 'npmVersion', 'wrangler'] },
    { name: '项目配置', checks: ['requiredFiles', 'packageJson', 'wranglerConfig'] },
    { name: '依赖管理', checks: ['dependencies'] },
    { name: '代码质量', checks: ['typescript', 'linting'] }
  ];
  
  let totalChecks = 0;
  let passedChecks = 0;
  
  for (const category of categories) {
    console.log(`\n${category.name}:`);
    
    for (const check of category.checks) {
      totalChecks++;
      if (results[check]) {
        passedChecks++;
        log(`  ✅ ${check}`, 'green');
      } else {
        log(`  ❌ ${check}`, 'red');
      }
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`总体评分: ${passedChecks}/${totalChecks} (${Math.round(passedChecks/totalChecks*100)}%)`);
  
  if (passedChecks === totalChecks) {
    logSuccess('🎉 环境配置完美！可以开始部署');
  } else if (passedChecks >= totalChecks * 0.8) {
    logWarning('⚠️  环境基本就绪，有一些可选项目未配置');
  } else {
    logError('❌ 环境配置存在重要问题，建议修复后再部署');
  }
  
  return passedChecks / totalChecks;
}

// 主函数
async function main() {
  console.log('🔧 环境设置检查工具\n');
  
  const results = {
    nodeVersion: checkNodeVersion(),
    npmVersion: checkNpmVersion(),
    wrangler: checkWrangler(),
    requiredFiles: checkRequiredFiles(),
    packageJson: checkPackageJson(),
    wranglerConfig: checkWranglerConfig(),
    dependencies: checkDependencies(),
    typescript: checkTypeScriptConfig(),
    linting: checkLinting()
  };
  
  const score = generateReport(results);
  
  // 提供修复建议
  if (score < 1.0) {
    console.log('\n🔧 修复建议:');
    
    if (!results.nodeVersion) {
      console.log('1. 升级 Node.js: https://nodejs.org/');
    }
    
    if (!results.wrangler) {
      console.log('2. 安装 Wrangler: npm install -g wrangler');
    }
    
    if (!results.dependencies) {
      console.log('3. 安装依赖: npm install');
    }
    
    if (!results.wranglerConfig) {
      console.log('4. 配置 wrangler.toml 文件');
    }
    
    console.log('\n运行修复命令后，再次运行此脚本验证');
  }
  
  process.exit(score >= 0.8 ? 0 : 1);
}

// 错误处理
process.on('unhandledRejection', (reason, _promise) => {
  logError(`未处理的 Promise 错误: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError(`未捕获的异常: ${error.message}`);
  process.exit(1);
});

// 运行主函数
main().catch((error) => {
  logError(`环境检查失败: ${error.message}`);
  process.exit(1);
});
