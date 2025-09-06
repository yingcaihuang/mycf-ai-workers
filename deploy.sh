#!/bin/bash

# 🚀 Cloudflare Workers AI 图像生成器自动化部署脚本
# 版本: 2.0
# 更新时间: 2025-09-06

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # 无颜色

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${PURPLE}🔄 $1${NC}"
}

# 检查依赖
check_dependencies() {
    log_step "检查系统依赖..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先安装 Node.js 18+"
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2)
    local major_version=$(echo $node_version | cut -d'.' -f1)
    if [ "$major_version" -lt 18 ]; then
        log_error "Node.js 版本过低（当前: $node_version），需要 18+"
        exit 1
    fi
    log_success "Node.js 版本正常: $node_version"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    log_success "npm 可用"
    
    # 检查 wrangler
    if ! command -v wrangler &> /dev/null; then
        log_warning "Wrangler 未安装，正在安装..."
        npm install -g wrangler
    fi
    log_success "Wrangler 可用"
}

# 检查认证状态
check_auth() {
    log_step "检查 Cloudflare 认证状态..."
    
    if ! wrangler whoami &> /dev/null; then
        log_warning "未登录 Cloudflare，启动登录流程..."
        wrangler auth login
        
        # 再次检查
        if ! wrangler whoami &> /dev/null; then
            log_error "登录失败，请检查网络连接和账户权限"
            exit 1
        fi
    fi
    
    local user_info=$(wrangler whoami 2>/dev/null || echo "获取用户信息失败")
    log_success "已登录 Cloudflare: $user_info"
}

# 安装依赖
install_dependencies() {
    log_step "安装项目依赖..."
    
    if [ ! -f "package.json" ]; then
        log_error "package.json 文件不存在"
        exit 1
    fi
    
    # 检查是否需要安装依赖
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        npm install
        log_success "依赖安装完成"
    else
        log_info "依赖已是最新"
    fi
}

# 设置 KV 命名空间
setup_kv_namespaces() {
    log_step "设置 KV 命名空间..."
    
    # 检查 wrangler.toml 中是否还有占位符
    if grep -q "your-kv-namespace-id" wrangler.toml; then
        log_warning "检测到未配置的 KV 命名空间，正在自动设置..."
        npm run setup:kv
        log_success "KV 命名空间设置完成"
    else
        log_info "KV 命名空间已配置"
    fi
}

# 运行代码检查
run_checks() {
    log_step "运行代码质量检查..."
    
    # 配置验证
    if npm run verify-config; then
        log_success "配置验证通过"
    else
        log_error "配置验证失败"
        exit 1
    fi
    
    # 代码检查
    if npm run lint:check; then
        log_success "代码风格检查通过"
    else
        log_warning "代码风格检查发现问题，尝试自动修复..."
        npm run lint:fix
    fi
    
    # 类型检查
    if npm run type-check; then
        log_success "TypeScript 类型检查通过"
    else
        log_error "TypeScript 类型检查失败"
        exit 1
    fi
}

# 部署函数
deploy_to_environment() {
    local env=${1:-"production"}
    
    log_step "部署到 $env 环境..."
    
    case $env in
        "development"|"dev")
            wrangler deploy --env development
            ;;
        "staging")
            wrangler deploy --env staging
            ;;
        "production"|"prod")
            wrangler deploy
            ;;
        *)
            log_error "未知环境: $env"
            exit 1
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        log_success "部署到 $env 环境成功！"
    else
        log_error "部署失败"
        exit 1
    fi
}

# 部署后验证
post_deploy_verification() {
    log_step "运行部署后验证..."
    
    if [ -f "scripts/post-deploy.js" ]; then
        node scripts/post-deploy.js
    else
        log_info "跳过部署后验证（脚本不存在）"
    fi
}

# 显示部署信息
show_deploy_info() {
    log_success "🎉 部署完成！"
    echo
    log_info "📋 部署信息："
    echo "   • 应用名称: ai-image-generator"
    echo "   • 部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "   • Git 提交: $(git rev-parse --short HEAD 2>/dev/null || echo '未知')"
    echo
    log_info "🔗 有用的链接："
    echo "   • Cloudflare Dashboard: https://dash.cloudflare.com"
    echo "   • Workers AI 文档: https://developers.cloudflare.com/workers-ai/"
    echo "   • 项目文档: ./README.md"
    echo
    log_info "🛠️ 常用命令："
    echo "   • 查看日志: npm run logs"
    echo "   • 本地开发: npm run dev"
    echo "   • 重新部署: npm run deploy"
    echo
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          🚀 Cloudflare Workers AI 图像生成器部署脚本          ║"
    echo "║                      自动化部署 v2.0                         ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # 解析命令行参数
    local environment="production"
    local skip_checks=false
    local force_setup=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)
                environment="$2"
                shift 2
                ;;
            --skip-checks)
                skip_checks=true
                shift
                ;;
            --force-setup)
                force_setup=true
                shift
                ;;
            -h|--help)
                echo "用法: $0 [选项]"
                echo "选项:"
                echo "  -e, --env ENV        目标环境 (development|staging|production)"
                echo "  --skip-checks        跳过代码质量检查"
                echo "  --force-setup        强制重新设置 KV 命名空间"
                echo "  -h, --help           显示帮助信息"
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                exit 1
                ;;
        esac
    done
    
    log_info "目标环境: $environment"
    
    # 执行部署流程
    check_dependencies
    check_auth
    install_dependencies
    
    if [ "$force_setup" = true ]; then
        log_info "强制重新设置 KV 命名空间..."
        npm run setup:kv
    else
        setup_kv_namespaces
    fi
    
    if [ "$skip_checks" != true ]; then
        run_checks
    else
        log_warning "跳过代码质量检查"
    fi
    
    deploy_to_environment "$environment"
    post_deploy_verification
    show_deploy_info
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查上面的错误信息"; exit 1' ERR

# 运行主函数
main "$@"
