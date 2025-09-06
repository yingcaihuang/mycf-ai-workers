#!/bin/bash

# 🚀 快速部署脚本 - 一键部署到 Cloudflare Workers
# 适用于急速部署场景

set -e

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}⚡ 快速部署模式${NC}"
echo "================================"

# 检查基础依赖
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler 未安装${NC}"
    echo "正在安装 Wrangler..."
    npm install -g wrangler
fi

# 检查登录状态
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}🔐 需要登录 Cloudflare${NC}"
    wrangler auth login
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 安装依赖...${NC}"
    npm install
fi

# 自动设置 KV（如果需要）
if grep -q "your-kv-namespace-id" wrangler.toml; then
    echo -e "${YELLOW}🗄️ 自动设置 KV 命名空间...${NC}"
    npm run setup:kv
fi

# 快速部署
echo -e "${BLUE}🚀 开始部署...${NC}"
wrangler deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 部署成功！${NC}"
    echo -e "${GREEN}🎉 您的 AI 图像生成器已上线！${NC}"
else
    echo -e "${RED}❌ 部署失败${NC}"
    exit 1
fi
