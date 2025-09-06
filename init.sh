#!/bin/bash

# 🚀 Cloudflare Workers AI 项目完整初始化脚本
# 自动完成所有必要的设置和配置

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${PURPLE}🔄 $1${NC}"; }

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       🚀 Cloudflare Workers AI 项目初始化向导                  ║"
echo "║                    完整自动化设置 v2.0                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 步骤 1: 环境检查
log_step "步骤 1/6: 环境检查"
echo "正在运行环境检查..."
if node scripts/environment-check.js; then
    log_success "环境检查通过"
else
    log_error "环境检查失败，请修复问题后重试"
    exit 1
fi

echo

# 步骤 2: 安装依赖
log_step "步骤 2/6: 安装项目依赖"
if [ ! -d "node_modules" ]; then
    npm install
    log_success "依赖安装完成"
else
    log_info "依赖已安装，跳过"
fi

echo

# 步骤 3: Cloudflare 认证
log_step "步骤 3/6: Cloudflare 认证"
if ! wrangler whoami &> /dev/null; then
    log_warning "需要登录 Cloudflare"
    wrangler auth login
    
    if wrangler whoami &> /dev/null; then
        log_success "Cloudflare 认证成功"
    else
        log_error "Cloudflare 认证失败"
        exit 1
    fi
else
    user_info=$(wrangler whoami)
    log_success "已认证: $user_info"
fi

echo

# 步骤 4: KV 命名空间设置
log_step "步骤 4/6: 设置 KV 命名空间"
if grep -q "\${KV_PRODUCTION_ID}" wrangler.toml || grep -q "your-kv-namespace-id" wrangler.toml; then
    log_info "正在创建 KV 命名空间..."
    npm run setup:kv
    log_success "KV 命名空间设置完成"
else
    log_info "KV 命名空间已配置"
fi

echo

# 步骤 5: 代码质量检查
log_step "步骤 5/6: 代码质量检查"
if npm run lint:check &> /dev/null; then
    log_success "代码风格检查通过"
else
    log_warning "发现代码风格问题，正在自动修复..."
    npm run lint:fix
    log_success "代码风格问题已修复"
fi

if npm run type-check &> /dev/null; then
    log_success "TypeScript 类型检查通过"
else
    log_warning "TypeScript 类型检查发现问题（非致命）"
fi

echo

# 步骤 6: 部署选项
log_step "步骤 6/6: 部署选项"
echo "项目初始化完成！请选择下一步操作："
echo
echo "1) 部署到生产环境"
echo "2) 部署到开发环境"
echo "3) 启动本地开发服务器"
echo "4) 跳过部署，稍后手动操作"
echo

read -p "请选择 [1-4]: " choice

case $choice in
    1)
        log_info "部署到生产环境..."
        ./deploy.sh --env production
        ;;
    2)
        log_info "部署到开发环境..."
        ./deploy.sh --env development
        ;;
    3)
        log_info "启动本地开发服务器..."
        log_success "运行 'npm run dev' 启动开发服务器"
        npm run dev
        ;;
    4)
        log_info "跳过部署"
        ;;
    *)
        log_warning "无效选择，跳过部署"
        ;;
esac

echo
log_success "🎉 项目初始化完成！"
echo
log_info "📋 常用命令："
echo "   • 本地开发: npm run dev"
echo "   • 部署应用: npm run deploy"
echo "   • 查看日志: npm run logs"
echo "   • 环境检查: node scripts/environment-check.js"
echo "   • KV 管理: node scripts/cleanup-kv.js stats"
echo
log_info "📚 项目文档："
echo "   • README.md - 项目说明"
echo "   • docs/development.md - 开发指南"
echo "   • examples/prompts.md - 提示词示例"
echo
log_info "🔗 有用链接："
echo "   • Cloudflare Dashboard: https://dash.cloudflare.com"
echo "   • Workers AI 文档: https://developers.cloudflare.com/workers-ai/"
echo "   • FLUX.1 模型文档: https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/"
