# 短视频字幕提取服务 - AutoDL 部署指南

## 快速开始

### 1. 租用 AutoDL GPU 服务器

1. 访问 [AutoDL](https://www.autodl.com/) 注册账号
2. 点击「租用机器」
3. 选择配置：
   - **显卡**: RTX 3090 或 RTX 4090
   - **镜像**: 选择「PyTorch 2.0 + Python 3.10」或「基础镜像」
   - **数据盘**: 建议 100GB+
4. 点击「立即租用」

### 2. 连接服务器

```bash
# 在 AutoDL 控制台获取登录信息
ssh root@你的服务器地址
```

### 3. 上传代码

**方式一：直接复制**
```bash
# 在 AutoDL 终端中创建文件
mkdir -p /root/video_app
# 然后复制 app.py 和 deploy.sh 的内容
```

**方式二：使用 scp 上传**
```bash
scp -r ./gpu_service root@你的服务器地址:/root/
```

### 4. 运行部署脚本

```bash
# 给脚本添加执行权限
chmod +x deploy.sh

# 运行部署（需要 root 权限）
sudo bash deploy.sh
```

脚本会自动完成：
- 安装 CUDA 驱动检查
- 安装系统依赖（ffmpeg、git 等）
- 创建 Python 虚拟环境
- 安装 Python 依赖（Whisper、yt-dlp 等）
- 配置 systemd 服务
- 启动服务

### 5. 配置防火墙

在 AutoDL 控制台：
1. 进入「容器实例」
2. 点击「防火墙配置」
3. 添加规则：开放 `5000` 端口

### 6. 测试服务

```bash
# 测试健康检查
curl http://localhost:5000/health

# 测试字幕提取（抖音视频）
curl -X POST http://localhost:5000/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://v.douyin.com/xxx"}'
```

## API 接口

### POST /extract

提取视频字幕

**请求**
```json
{
  "url": "https://v.douyin.com/xxx",
  "use_cache": true
}
```

**响应（成功）**
```json
{
  "success": true,
  "subtitles": "今天给大家推荐一个超棒的旅游景点...",
  "title": "北京必去的10个景点",
  "duration": 120.5,
  "platform": "douyin",
  "cached": false
}
```

**响应（失败）**
```json
{
  "success": false,
  "error": "无法提取字幕内容，请手动输入文字描述"
}
```

### GET /health

健康检查

**响应**
```json
{
  "status": "ok",
  "model_loaded": true
}
```

## 支持的平台

| 平台 | 支持状态 | 说明 |
|------|----------|------|
| 抖音 | ✅ | 优先获取字幕 |
| 小红书 | ✅ | 获取视频描述 |
| B站 | ✅ | 获取字幕 |
| 快手 | ✅ | 获取字幕 |
| 视频号 | ✅ | 获取字幕 |
| 微博 | ✅ | 获取字幕 |
| YouTube | ✅ | 获取字幕 |
| 其他 | ⚠️ | 降级使用 Whisper |

## 成本控制

### 按需启动

```bash
# 不用时停止服务
systemctl stop video-extract

# 节省 GPU 费用
# AutoDL 按小时计费，停止后不计费
```

### 查看 GPU 使用

```bash
# 实时监控
watch -n 1 nvidia-smi

# 查看显存使用
nvidia-smi
```

### 查看服务状态

```bash
# 查看服务状态
systemctl status video-extract

# 查看日志
journalctl -u video-extract -f

# 查看 Whisper 模型加载情况
journalctl -u video-extract | grep "加载"
```

## 故障排除

### 问题 1：Whisper 模型加载失败

```bash
# 手动加载
source /root/venv/bin/activate
python -c "import whisper; whisper.load_model('base')"
```

### 问题 2：yt-dlp 无法下载视频

```bash
# 更新 yt-dlp
pip install -U yt-dlp

# 测试下载
yt-dlp --no-download "视频链接"
```

### 问题 3：服务启动失败

```bash
# 查看错误日志
journalctl -u video-extract -e

# 手动启动测试
cd /root/video_app
source /root/venv/bin/activate
python app.py
```

## 配置后端调用

在你的 NestJS 后端添加配置：

```typescript
// .env
GPU_SERVER_URL=http://你的AutoDL服务器地址:5000
```

```typescript
// parse.service.ts
@Injectable()
export class ParseService {
  private gpuServerUrl = process.env.GPU_SERVER_URL

  async extractVideoSubtitle(url: string): Promise<string | null> {
    if (!this.gpuServerUrl) {
      console.warn('GPU 服务器未配置')
      return null
    }

    try {
      const response = await fetch(`${this.gpuServerUrl}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, use_cache: true })
      })

      const data = await response.json()
      
      if (data.success) {
        return data.subtitles
      }
      
      console.warn('字幕提取失败:', data.error)
      return null
    } catch (error) {
      console.error('调用 GPU 服务失败:', error)
      return null
    }
  }
}
```

## 费用估算

| 配置 | RTX 3090 | RTX 4090 |
|------|----------|----------|
| 按量计费 | ¥0.78/小时 | ¥1.0/小时 |
| 包日 | ¥15/天 | ¥20/天 |
| 包月 | ¥300/月 | ¥450/月 |

**建议**：前期按量计费，每天用完停止，确认稳定后再包月。
