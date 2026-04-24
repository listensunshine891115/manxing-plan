#!/bin/bash
# ===========================================
# AutoDL GPU 服务器快速部署脚本
# ===========================================

set -e

echo "=========================================="
echo "  短视频字幕提取服务 - AutoDL 部署脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}请使用 root 用户运行此脚本${NC}"
        echo "或者使用: sudo bash deploy.sh"
        exit 1
    fi
}

# 检查 CUDA
check_cuda() {
    echo -e "${YELLOW}[1/5] 检查 CUDA 环境...${NC}"
    
    if command -v nvidia-smi &> /dev/null; then
        nvidia-smi --query-gpu=name,memory.total --format=csv
        echo -e "${GREEN}✓ CUDA 已安装${NC}"
    else
        echo -e "${RED}✗ CUDA 未安装${NC}"
        exit 1
    fi
}

# 安装依赖
install_deps() {
    echo -e "${YELLOW}[2/5] 安装系统依赖...${NC}"
    
    # 更新 apt
    apt update -qq
    
    # 安装基础工具
    apt install -y -qq \
        curl \
        wget \
        git \
        ffmpeg \
        python3-pip \
        python3-venv \
        || true
    
    echo -e "${GREEN}✓ 系统依赖安装完成${NC}"
}

# 安装 Python 依赖
install_python_deps() {
    echo -e "${YELLOW}[3/5] 安装 Python 依赖...${NC}"
    
    # 创建虚拟环境
    python3 -m venv /root/venv
    source /root/venv/bin/activate
    
    # 升级 pip
    pip install --upgrade pip -qq
    
    # 安装核心依赖
    pip install -qq \
        fastapi \
        uvicorn[standard] \
        pydantic \
        yt-dlp \
        openai-whisper \
        torch \
        torchvision \
        torchaudio \
        --index-url https://download.pytorch.org/whl/cu118 \
        2>/dev/null || \
    pip install -qq \
        fastapi \
        uvicorn[standard] \
        pydantic \
        yt-dlp \
        openai-whisper \
        torch
    
    # 安装 CUDA 版本
    pip install -qq torch --index-url https://download.pytorch.org/whl/cu118 || true
    
    echo -e "${GREEN}✓ Python 依赖安装完成${NC}"
    echo -e "${GREEN}  虚拟环境: /root/venv${NC}"
    echo -e "${GREEN}  激活命令: source /root/venv/bin/activate${NC}"
}

# 复制应用代码
deploy_app() {
    echo -e "${YELLOW}[4/5] 部署应用...${NC}"
    
    # 创建应用目录
    mkdir -p /root/video_app
    mkdir -p /root/video_cache
    
    # 复制代码（如果当前目录有 app.py）
    if [ -f "$(dirname $0)/app.py" ]; then
        cp "$(dirname $0)/app.py" /root/video_app/
        echo -e "${GREEN}✓ 应用代码已复制${NC}"
    else
        echo -e "${YELLOW}  注意: 未找到 app.py，请手动复制到 /root/video_app/${NC}"
    fi
}

# 配置服务
config_service() {
    echo -e "${YELLOW}[5/5] 配置系统服务...${NC}"
    
    # 创建 systemd 服务文件
    cat > /etc/systemd/system/video-extract.service << 'EOF'
[Unit]
Description=Video Subtitle Extract Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/video_app
Environment="PATH=/root/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"
ExecStart=/root/venv/bin/uvicorn app:app --host 0.0.0.0 --port 5000 --workers 1
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # 重新加载 systemd
    systemctl daemon-reload
    
    # 启用服务
    systemctl enable video-extract
    systemctl start video-extract
    
    echo -e "${GREEN}✓ 服务已配置并启动${NC}"
}

# 测试服务
test_service() {
    echo ""
    echo -e "${YELLOW}测试服务...${NC}"
    
    sleep 3
    
    # 测试健康检查
    if curl -s http://localhost:5000/health | grep -q "ok"; then
        echo -e "${GREEN}✓ 服务运行正常${NC}"
    else
        echo -e "${YELLOW}  服务可能还在启动中，请稍后检查${NC}"
        echo "  检查命令: curl http://localhost:5000/health"
    fi
    
    # 显示日志
    echo ""
    echo -e "${YELLOW}最近日志:${NC}"
    journalctl -u video-extract -n 10 --no-pager 2>/dev/null || \
    tail -20 /root/video_app/*.log 2>/dev/null || \
    echo "  日志文件未找到"
}

# 显示使用说明
show_help() {
    echo ""
    echo "=========================================="
    echo "  部署完成！"
    echo "=========================================="
    echo ""
    echo "服务地址: http://0.0.0.0:5000"
    echo ""
    echo "接口调用:"
    echo "  POST /extract"
    echo "  Body: {\"url\": \"https://...\", \"use_cache\": true}"
    echo ""
    echo "测试命令:"
    echo "  curl -X POST http://localhost:5000/extract \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"url\": \"https://v.douyin.com/xxx\"}'"
    echo ""
    echo "服务管理:"
    echo "  启动: systemctl start video-extract"
    echo "  停止: systemctl stop video-extract"
    echo "  重启: systemctl restart video-extract"
    echo "  状态: systemctl status video-extract"
    echo "  日志: journalctl -u video-extract -f"
    echo ""
    echo "GPU 监控:"
    echo "  watch -n 1 nvidia-smi"
    echo ""
}

# 主流程
main() {
    check_root
    check_cuda
    install_deps
    install_python_deps
    deploy_app
    config_service
    test_service
    show_help
}

# 运行
main "$@"
