// 配置验证和健康检查脚本

const fs = require('fs');
const path = require('path');

console.log('🔍 验证项目配置...\n');

// 检查必需文件
const requiredFiles = [
  'package.json',
  'wrangler.toml',
  'src/index.js',
  'README.md'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - 文件缺失`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ 部分必需文件缺失，请检查项目结构');
  process.exit(1);
}

// 检查 wrangler.toml 配置
console.log('\n🔧 检查 wrangler.toml 配置...');

try {
  const wranglerConfig = fs.readFileSync(path.join(__dirname, '..', 'wrangler.toml'), 'utf8');
  
  if (wranglerConfig.includes('your-kv-namespace-id')) {
    console.log('⚠️  KV 命名空间 ID 尚未配置');
    console.log('   请运行以下命令创建 KV 命名空间：');
    console.log('   wrangler kv:namespace create "IMAGE_STORE"');
    console.log('   wrangler kv:namespace create "IMAGE_STORE" --preview');
  } else {
    console.log('✅ KV 命名空间配置正确');
  }
  
  if (wranglerConfig.includes('[ai]')) {
    console.log('✅ AI binding 配置正确');
  } else {
    console.log('❌ AI binding 配置缺失');
  }
  
} catch (error) {
  console.log('❌ 无法读取 wrangler.toml 文件');
}

// 检查 package.json
console.log('\n📦 检查 package.json...');

try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  
  if (packageJson.scripts && packageJson.scripts.dev) {
    console.log('✅ 开发脚本配置正确');
  } else {
    console.log('❌ 开发脚本配置缺失');
  }
  
  if (packageJson.scripts && packageJson.scripts.deploy) {
    console.log('✅ 部署脚本配置正确');
  } else {
    console.log('❌ 部署脚本配置缺失');
  }
  
} catch (error) {
  console.log('❌ 无法读取 package.json 文件');
}

console.log('\n🎯 下一步操作：');
console.log('1. 安装依赖: npm install');
console.log('2. 配置 KV 命名空间（如果尚未配置）');
console.log('3. 本地开发: npm run dev');
console.log('4. 部署到生产: npm run deploy');
console.log('\n✨ 配置验证完成！');
