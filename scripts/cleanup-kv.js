#!/usr/bin/env node

/**
 * KV 存储清理脚本
 * 清理过期的图像数据和历史记录
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

// 获取 KV 命名空间信息
function getKVNamespaceInfo() {
  try {
    const wranglerPath = path.join(__dirname, '../wrangler.toml');
    const content = fs.readFileSync(wranglerPath, 'utf8');
    
    // 提取 KV binding 名称
    const bindingMatch = content.match(/binding = "([^"]+)"/);
    const binding = bindingMatch ? bindingMatch[1] : 'IMAGE_STORE';
    
    return { binding };
  } catch (error) {
    logError('无法读取 wrangler.toml 配置');
    return { binding: 'IMAGE_STORE' };
  }
}

// 列出所有 KV 键
async function listKVKeys(binding) {
  try {
    logStep('获取 KV 存储中的所有键...');
    
    const output = execSync(`wrangler kv:key list --binding ${binding}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const keys = JSON.parse(output);
    logInfo(`发现 ${keys.length} 个键`);
    
    return keys;
  } catch (error) {
    logError(`列出 KV 键失败: ${error.message}`);
    return [];
  }
}

// 删除过期的历史记录
async function cleanupExpiredHistory(binding, daysOld = 7) {
  try {
    logStep(`清理 ${daysOld} 天前的历史记录...`);
    
    const keys = await listKVKeys(binding);
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    let deletedCount = 0;
    
    for (const key of keys) {
      if (key.name.startsWith('history:')) {
        const timestamp = parseInt(key.name.replace('history:', ''));
        
        if (timestamp < cutoffTime) {
          try {
            execSync(`wrangler kv:key delete --binding ${binding} "${key.name}"`, {
              stdio: 'pipe'
            });
            deletedCount++;
            logInfo(`删除过期记录: ${key.name}`);
          } catch (error) {
            logWarning(`删除键失败: ${key.name}`);
          }
        }
      }
    }
    
    logSuccess(`清理完成，删除了 ${deletedCount} 个过期记录`);
    return deletedCount;
  } catch (error) {
    logError(`清理过期历史记录失败: ${error.message}`);
    return 0;
  }
}

// 清理所有数据（危险操作）
async function clearAllData(binding) {
  logWarning('⚠️  这将删除所有 KV 数据，此操作不可恢复！');
  
  // 确认提示
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('确认删除所有数据？输入 "DELETE_ALL" 确认: ', (answer) => {
      rl.close();
      
      if (answer === 'DELETE_ALL') {
        performClearAll(binding).then(resolve);
      } else {
        logInfo('操作已取消');
        resolve(0);
      }
    });
  });
}

async function performClearAll(binding) {
  try {
    logStep('删除所有 KV 数据...');
    
    const keys = await listKVKeys(binding);
    let deletedCount = 0;
    
    for (const key of keys) {
      try {
        execSync(`wrangler kv:key delete --binding ${binding} "${key.name}"`, {
          stdio: 'pipe'
        });
        deletedCount++;
      } catch (error) {
        logWarning(`删除键失败: ${key.name}`);
      }
    }
    
    logSuccess(`删除了 ${deletedCount} 个键`);
    return deletedCount;
  } catch (error) {
    logError(`清理所有数据失败: ${error.message}`);
    return 0;
  }
}

// 显示存储统计
async function showStorageStats(binding) {
  try {
    logStep('分析存储使用情况...');
    
    const keys = await listKVKeys(binding);
    
    const stats = {
      total: keys.length,
      history: 0,
      other: 0,
      totalSize: 0
    };
    
    for (const key of keys) {
      if (key.name.startsWith('history:')) {
        stats.history++;
      } else {
        stats.other++;
      }
      
      // 估算大小（KV 键名 + 元数据）
      stats.totalSize += key.name.length;
    }
    
    console.log('\n📊 存储统计:');
    console.log(`   总键数: ${stats.total}`);
    console.log(`   历史记录: ${stats.history}`);
    console.log(`   其他数据: ${stats.other}`);
    console.log(`   估算键名大小: ${(stats.totalSize / 1024).toFixed(2)} KB`);
    
    // 显示最近的历史记录
    const historyKeys = keys
      .filter(k => k.name.startsWith('history:'))
      .sort((a, b) => {
        const timestampA = parseInt(a.name.replace('history:', ''));
        const timestampB = parseInt(b.name.replace('history:', ''));
        return timestampB - timestampA;
      })
      .slice(0, 5);
    
    if (historyKeys.length > 0) {
      console.log('\n🕒 最近的历史记录:');
      historyKeys.forEach(key => {
        const timestamp = parseInt(key.name.replace('history:', ''));
        const date = new Date(timestamp).toLocaleString('zh-CN');
        console.log(`   ${date} (${key.name})`);
      });
    }
    
    return stats;
  } catch (error) {
    logError(`获取存储统计失败: ${error.message}`);
    return null;
  }
}

// 主函数
async function main() {
  console.log('🧹 KV 存储清理工具\n');
  
  // 检查 wrangler 认证
  try {
    execSync('wrangler whoami', { stdio: 'pipe' });
  } catch (error) {
    logError('请先登录 Wrangler: wrangler auth login');
    process.exit(1);
  }
  
  const { binding } = getKVNamespaceInfo();
  logInfo(`使用 KV 绑定: ${binding}`);
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  const command = args[0] || 'stats';
  
  switch (command) {
    case 'stats':
    case 'status':
      await showStorageStats(binding);
      break;
      
    case 'cleanup':
      const days = parseInt(args[1]) || 7;
      await cleanupExpiredHistory(binding, days);
      break;
      
    case 'clear':
    case 'clear-all':
      await clearAllData(binding);
      break;
      
    case 'help':
    case '--help':
    case '-h':
      console.log('用法: node cleanup-kv.js [命令] [参数]');
      console.log('');
      console.log('命令:');
      console.log('  stats              显示存储统计信息 (默认)');
      console.log('  cleanup [天数]     清理指定天数前的历史记录 (默认: 7天)');
      console.log('  clear              清理所有数据 (危险操作)');
      console.log('  help               显示帮助信息');
      console.log('');
      console.log('示例:');
      console.log('  node cleanup-kv.js stats           # 显示存储统计');
      console.log('  node cleanup-kv.js cleanup 30      # 清理30天前的记录');
      console.log('  node cleanup-kv.js clear           # 清理所有数据');
      break;
      
    default:
      logError(`未知命令: ${command}`);
      console.log('运行 "node cleanup-kv.js help" 查看帮助');
      process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  logError(`未处理的 Promise 错误: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError(`未捕获的异常: ${error.message}`);
  process.exit(1);
});

// 运行主函数
main().catch((error) => {
  logError(`清理失败: ${error.message}`);
  process.exit(1);
});
