# 🚀 自动化部署指南

这个项目包含了完整的自动化部署系统，让您可以轻松地将 AI 图像生成应用部署到 Cloudflare Workers。

## 📋 部署方式总览

### 1. 🎯 一键初始化（推荐新用户）

```bash
npm run init
# 或者
./init.sh
```

这个脚本会：
- ✅ 检查系统环境和依赖
- 📦 自动安装必要的依赖
- 🔐 引导您登录 Cloudflare
- 🗄️ 自动创建和配置 KV 命名空间
- 🔍 运行代码质量检查
- 🚀 提供部署选项

### 2. ⚡ 快速部署（适合有经验用户）

```bash
npm run deploy:quick
# 或者
./quick-deploy.sh
```

最小化的部署流程，跳过详细检查，直接部署。

### 3. 🔧 标准部署（推荐生产环境）

```bash
npm run deploy
# 或者
./deploy.sh
```

完整的部署流程，包含所有检查和验证步骤。

### 4. 🎯 环境特定部署

```bash
# 开发环境
npm run deploy:dev

# 预发布环境
npm run deploy:staging  

# 生产环境
npm run deploy:production
```

## 🛠️ 配置管理

### 自动化 KV 设置

```bash
npm run setup:kv
```

自动创建和配置 Cloudflare KV 命名空间：
- 🏭 生产环境命名空间
- 👀 预览环境命名空间
- 📝 自动更新 `wrangler.toml` 配置

### 环境检查

```bash
npm run environment-check
```

全面检查部署环境：
- ✅ Node.js 和 npm 版本
- 🔧 Wrangler CLI 安装和登录状态
- 📁 必需文件存在性
- ⚙️ 配置文件完整性
- 📦 依赖安装状态
- 🎨 代码质量工具

### 配置验证

```bash
npm run verify-config
```

验证项目配置是否正确：
- 📋 `package.json` 脚本配置
- ⚙️ `wrangler.toml` 必要设置
- 🗄️ KV 命名空间配置状态

## 🗄️ KV 存储管理

### 查看存储统计

```bash
npm run kv:stats
```

显示：
- 📊 总键数和分类统计
- 💾 存储使用量估算
- 🕒 最近的生成记录

### 清理过期数据

```bash
npm run kv:cleanup       # 清理 7 天前的数据
npm run kv:cleanup 30    # 清理 30 天前的数据
```

### 完全清空存储（危险操作）

```bash
npm run kv:clear
```

⚠️ **警告**: 这会删除所有用户数据，操作不可恢复！

## 🔍 部署后验证

### 自动验证

```bash
npm run health-check
```

自动运行：
- 🏥 基础健康检查
- 🔌 API 端点测试
- ⚡ 性能测试
- 🤖 AI 功能测试（可选）

### 查看日志

```bash
npm run logs              # 生产环境日志
npm run logs:staging      # 预发布环境日志
```

## 📊 脚本参数说明

### 部署脚本参数

```bash
./deploy.sh [选项]

选项:
  -e, --env ENV        目标环境 (development|staging|production)
  --skip-checks        跳过代码质量检查
  --force-setup        强制重新设置 KV 命名空间
  -h, --help           显示帮助信息
```

### KV 清理脚本参数

```bash
node scripts/cleanup-kv.js [命令] [参数]

命令:
  stats              显示存储统计信息 (默认)
  cleanup [天数]     清理指定天数前的历史记录 (默认: 7天)
  clear              清理所有数据 (危险操作)
  help               显示帮助信息
```

## 🔧 故障排除

### 常见问题

1. **Wrangler 未安装**
   ```bash
   npm install -g wrangler
   ```

2. **未登录 Cloudflare**
   ```bash
   wrangler auth login
   ```

3. **KV 命名空间配置错误**
   ```bash
   npm run setup:kv
   ```

4. **依赖安装问题**
   ```bash
   npm run fresh-install
   ```

5. **代码风格问题**
   ```bash
   npm run lint:fix
   ```

### 调试模式

启用详细日志输出：
```bash
DEBUG=true ./deploy.sh
```

### 清理和重置

```bash
npm run clean         # 清理构建缓存
npm run fresh-install # 重新安装依赖
```

## 📈 部署流程图

```
📋 环境检查
    ↓
🔐 Cloudflare 认证
    ↓
📦 安装依赖
    ↓
🗄️ KV 命名空间设置
    ↓
🔍 代码质量检查
    ↓
🚀 部署到 Workers
    ↓
✅ 部署后验证
    ↓
🎉 完成
```

## 🎯 最佳实践

1. **首次部署**: 使用 `npm run init` 进行完整初始化
2. **日常开发**: 使用 `npm run dev` 本地开发
3. **快速修复**: 使用 `npm run deploy:quick` 快速部署
4. **生产发布**: 使用 `npm run deploy:production` 正式部署
5. **定期维护**: 使用 `npm run kv:cleanup` 清理过期数据

## 📞 获取帮助

- 📖 查看项目 README.md
- 🛠️ 运行 `npm run environment-check` 诊断问题
- 📋 检查 `docs/development.md` 开发指南
- 🔗 访问 [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)

---

💡 **提示**: 所有脚本都包含详细的错误提示和修复建议，遇到问题时请仔细阅读输出信息。
