#!/usr/bin/env node

/**
 * KV 存储清理脚本
 */

const { execSync } = require('child_process');
const readline = require('readline');

console.log('🧹 KV 存储清理工具\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function listKVKeys(prefix = '') {
  try {
    const command = prefix 
      ? `wrangler kv:key list --binding IMAGE_STORE --prefix "${prefix}"`
      : 'wrangler kv:key list --binding IMAGE_STORE';
    
    const output = execSync(command, { encoding: 'utf8' });
    const keys = JSON.parse(output);
    return keys;
  } catch (error) {
    console.error('❌ 获取 KV 键列表失败:', error.message);
    return [];
  }
}

async function deleteKVKey(key) {
  try {
    execSync(`wrangler kv:key delete --binding IMAGE_STORE "${key}"`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.error(`❌ 删除键 "${key}" 失败:`, error.message);
    return false;
  }
}

async function clearHistoryData() {
  console.log('🗂️ 清理历史数据...\n');

  const historyKeys = await listKVKeys('history:');
  
  if (historyKeys.length === 0) {
    console.log('ℹ️ 没有找到历史数据');
    return;
  }

  console.log(`📊 找到 ${historyKeys.length} 条历史记录:`);
  historyKeys.slice(0, 5).forEach((key, index) => {
    console.log(`  ${index + 1}. ${key.name} (${new Date(parseInt(key.name.split(':')[1])).toLocaleString()})`);
  });
  
  if (historyKeys.length > 5) {
    console.log(`  ... 还有 ${historyKeys.length - 5} 条记录`);
  }

  const confirm = await question('\n确定要删除所有历史数据吗？(y/N): ');
  
  if (confirm.toLowerCase() === 'y') {
    let deleted = 0;
    for (const key of historyKeys) {
      const success = await deleteKVKey(key.name);
      if (success) {
        deleted++;
        process.stdout.write(`\r🗑️ 已删除 ${deleted}/${historyKeys.length} 条记录`);
      }
    }
    console.log(`\n✅ 成功删除 ${deleted} 条历史记录`);
  } else {
    console.log('❌ 取消删除操作');
  }
}

async function clearAllData() {
  console.log('🚨 清理所有数据...\n');

  const allKeys = await listKVKeys();
  
  if (allKeys.length === 0) {
    console.log('ℹ️ KV 存储为空');
    return;
  }

  console.log(`📊 找到 ${allKeys.length} 个存储项`);
  
  const confirm = await question('⚠️ 这将删除所有数据，确定继续吗？(y/N): ');
  
  if (confirm.toLowerCase() === 'y') {
    const doubleConfirm = await question('🚨 最后确认，输入 "DELETE" 来确认删除: ');
    
    if (doubleConfirm === 'DELETE') {
      let deleted = 0;
      for (const key of allKeys) {
        const success = await deleteKVKey(key.name);
        if (success) {
          deleted++;
          process.stdout.write(`\r🗑️ 已删除 ${deleted}/${allKeys.length} 个项目`);
        }
      }
      console.log(`\n✅ 成功删除 ${deleted} 个存储项`);
    } else {
      console.log('❌ 确认失败，取消删除操作');
    }
  } else {
    console.log('❌ 取消删除操作');
  }
}

async function showKVStats() {
  console.log('📊 KV 存储统计信息\n');

  const allKeys = await listKVKeys();
  
  if (allKeys.length === 0) {
    console.log('ℹ️ KV 存储为空');
    return;
  }

  // 按前缀分类
  const stats = {};
  let totalSize = 0;

  allKeys.forEach(key => {
    const prefix = key.name.includes(':') ? key.name.split(':')[0] : 'other';
    if (!stats[prefix]) {
      stats[prefix] = { count: 0, size: 0 };
    }
    stats[prefix].count++;
    // 注意：Wrangler list 不返回大小信息，这里只能统计数量
  });

  console.log('📋 存储项目分类:');
  Object.entries(stats).forEach(([prefix, data]) => {
    console.log(`  ${prefix}: ${data.count} 项`);
  });

  console.log(`\n📊 总计: ${allKeys.length} 个存储项`);

  // 显示最近的历史记录
  const historyKeys = allKeys
    .filter(key => key.name.startsWith('history:'))
    .sort((a, b) => {
      const timeA = parseInt(a.name.split(':')[1]);
      const timeB = parseInt(b.name.split(':')[1]);
      return timeB - timeA;
    })
    .slice(0, 5);

  if (historyKeys.length > 0) {
    console.log('\n🕒 最近的历史记录:');
    historyKeys.forEach((key, index) => {
      const timestamp = parseInt(key.name.split(':')[1]);
      console.log(`  ${index + 1}. ${new Date(timestamp).toLocaleString()}`);
    });
  }
}

async function main() {
  try {
    console.log('🛠️ KV 存储管理选项:');
    console.log('  1. 查看统计信息');
    console.log('  2. 清理历史数据');
    console.log('  3. 清理所有数据');
    console.log('  4. 退出');

    const choice = await question('\n请选择操作 (1-4): ');

    switch (choice) {
      case '1':
        await showKVStats();
        break;
      case '2':
        await clearHistoryData();
        break;
      case '3':
        await clearAllData();
        break;
      case '4':
        console.log('👋 再见！');
        break;
      default:
        console.log('❌ 无效选择');
    }

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  } finally {
    rl.close();
  }
}

main();
