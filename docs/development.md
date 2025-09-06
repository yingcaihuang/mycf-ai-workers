# 开发环境设置指南

## Cloudflare Workers 本地开发配置

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler auth login
```

### 3. 创建 KV 命名空间

```bash
# 创建生产环境 KV 命名空间
wrangler kv:namespace create "IMAGE_STORE"

# 创建预览环境 KV 命名空间  
wrangler kv:namespace create "IMAGE_STORE" --preview
```

### 4. 更新 wrangler.toml

将创建的 KV 命名空间 ID 填入 `wrangler.toml` 文件中对应的字段。

### 5. 启用 Workers AI

确保您的 Cloudflare 账户已启用 Workers AI 功能：
1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages
3. 启用 AI 功能

## 环境变量说明

- `ENVIRONMENT`: 当前运行环境，可选值：development, production

## 开发工作流

1. **本地开发**:
   ```bash
   npm run dev
   ```

2. **构建检查**:
   ```bash
   npm run build
   ```

3. **部署到生产**:
   ```bash
   npm run deploy
   ```

## 故障排除

### 常见问题

1. **KV 命名空间未找到**
   - 确保已创建 KV 命名空间
   - 检查 wrangler.toml 中的 ID 是否正确

2. **AI 模型调用失败**
   - 确保账户已启用 Workers AI
   - 检查 AI binding 配置

3. **本地开发时无法访问**
   - 检查是否正确运行 `wrangler dev`
   - 确认端口 8787 未被占用

### 调试技巧

- 使用 `console.log()` 在 Workers 中记录调试信息
- 查看 Wrangler 控制台输出获取错误详情
- 使用 Cloudflare Dashboard 查看 Workers 日志
