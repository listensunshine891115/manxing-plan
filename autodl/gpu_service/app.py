"""
短视频字幕提取服务
用于 AutoDL 托管 GPU 服务器

功能：
1. 用 yt-dlp 提取视频字幕（优先获取平台字幕）
2. 用 Whisper 语音转写（字幕不足时降级使用）

依赖安装：
pip install yt-dlp openai-whisper fastapi uvicorn

启动服务：
uvicorn app:app --host 0.0.0.0 --port 5000
"""

import os
import subprocess
import tempfile
import hashlib
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import whisper
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="短视频字幕提取服务")

# 全局变量
model = None
cache_dir = "/root/video_cache"  # 字幕缓存目录

class ExtractRequest(BaseModel):
    url: str
    use_cache: bool = True  # 是否使用缓存

class ExtractResponse(BaseModel):
    success: bool
    subtitles: Optional[str] = None
    title: Optional[str] = None
    duration: Optional[float] = None
    platform: Optional[str] = None
    error: Optional[str] = None
    cached: bool = False

def init_model():
    """初始化 Whisper 模型"""
    global model
    if model is None:
        logger.info("正在加载 Whisper 模型...")
        # base 模型：速度快，中文效果好
        # 可选：tiny(39M)/base(74M)/small(244M)/medium(769M)/large(1550M)
        model = whisper.load_model("base", device="cuda")
        logger.info("Whisper 模型加载完成")

def get_cache_key(url: str) -> str:
    """生成缓存 key"""
    return hashlib.md5(url.encode()).hexdigest()

def get_cache_path(url: str) -> str:
    """获取缓存文件路径"""
    cache_key = get_cache_key(url)
    return os.path.join(cache_dir, f"{cache_key}.txt")

def save_to_cache(url: str, content: str):
    """保存到缓存"""
    os.makedirs(cache_dir, exist_ok=True)
    cache_path = get_cache_path(url)
    with open(cache_path, 'w', encoding='utf-8') as f:
        f.write(content)
    logger.info(f"字幕已缓存: {cache_path}")

def get_from_cache(url: str) -> Optional[str]:
    """从缓存读取"""
    cache_path = get_cache_path(url)
    if os.path.exists(cache_path):
        logger.info(f"从缓存读取: {cache_path}")
        with open(cache_path, 'r', encoding='utf-8') as f:
            return f.read()
    return None

def detect_platform(url: str) -> str:
    """检测视频平台"""
    url_lower = url.lower()
    
    if 'douyin.com' in url_lower or 'v.douyin' in url_lower:
        return 'douyin'
    elif 'xiaohongshu.com' in url_lower or 'xhslink.com' in url_lower:
        return 'xiaohongshu'
    elif 'bilibili.com' in url_lower or 'b23.tv' in url_lower:
        return 'bilibili'
    elif 'kuaishou.com' in url_lower or 'ksurl.cn' in url_lower:
        return 'kuaishou'
    elif 'weishi.qq.com' in url_lower:
        return 'weishi'
    elif 'weibo.com' in url_lower:
        return 'weibo'
    elif 'youtube.com' in url_lower or 'youtu.be' in url_lower:
        return 'youtube'
    elif 'ixigua.com' in url_lower:
        return 'ixigua'
    else:
        return 'unknown'

def extract_subtitle_with_ytdlp(url: str, output_dir: str) -> tuple[Optional[str], Optional[str], Optional[float]]:
    """
    用 yt-dlp 提取字幕
    
    Returns:
        (字幕文本, 标题, 时长)
    """
    logger.info(f"开始提取字幕: {url}")
    
    try:
        # yt-dlp 命令：获取信息 + 下载字幕
        cmd = [
            'yt-dlp',
            '--write-auto-sub',           # 下载自动字幕
            '--sub-lang', 'zh,zh-CN,zh-Hans,en',  # 优先中文
            '--skip-download',            # 不下载视频
            '--dump-json',                # 输出视频信息
            '-o', os.path.join(output_dir, 'video'),
            url
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        logger.info(f"yt-dlp 输出: {result.stdout[:500]}")
        if result.stderr:
            logger.info(f"yt-dlp 错误: {result.stderr[:500]}")
        
        # 解析视频信息
        title = None
        duration = None
        subtitles = None
        
        for line in result.stdout.split('\n'):
            if line.strip().startswith('{'):
                try:
                    import json
                    info = json.loads(line)
                    title = info.get('title', '')
                    duration = info.get('duration')
                    
                    # 尝试获取字幕路径
                    subtitles_dict = info.get('automatic_captions', {})
                    
                    # 查找可用的字幕
                    for lang in ['zh-Hans', 'zh-CN', 'zh', 'en']:
                        if lang in subtitles_dict:
                            subtitle_url = subtitles_dict[lang][0]['url']
                            # 下载字幕
                            sub_cmd = [
                                'curl', '-s', '-L', 
                                '--max-time', '30',
                                subtitle_url
                            ]
                            sub_result = subprocess.run(
                                sub_cmd,
                                capture_output=True,
                                text=True,
                                timeout=30
                            )
                            
                            if sub_result.stdout:
                                # 转换为 srt/vtt 格式
                                subtitles = convert_subtitle(sub_result.stdout)
                                if subtitles:
                                    logger.info(f"成功获取字幕，语言: {lang}")
                                    return subtitles, title, duration
                    break
                except Exception as e:
                    logger.warning(f"解析视频信息失败: {e}")
                    continue
        
        return subtitles, title, duration
        
    except subprocess.TimeoutExpired:
        logger.error("yt-dlp 超时")
        return None, None, None
    except Exception as e:
        logger.error(f"yt-dlp 错误: {e}")
        return None, None, None

def convert_subtitle(content: str) -> Optional[str]:
    """
    转换字幕格式为纯文本
    支持 srt、vtt、ass 格式
    """
    lines = []
    
    for line in content.split('\n'):
        line = line.strip()
        
        # 跳过时间轴行
        if '-->' in line or line.startswith('WEBVTT') or line.startswith('Script'):
            continue
        
        # 跳过序号行
        if line.isdigit():
            continue
        
        # 跳过空行和标签
        if not line or line.startswith('[') or line.startswith('<!'):
            continue
        
        # 清理 HTML 标签
        import re
        line = re.sub(r'<[^>]+>', '', line)
        line = line.strip()
        
        if line:
            lines.append(line)
    
    return ' '.join(lines) if lines else None

def transcribe_with_whisper(audio_path: str) -> Optional[str]:
    """
    用 Whisper 转写音频
    """
    if model is None:
        init_model()
    
    logger.info(f"开始 Whisper 转写: {audio_path}")
    
    try:
        result = model.transcribe(
            audio_path,
            language='zh',
            task='transcribe',
            # 优化参数
            best_of=3,
            beam_size=3,
            vad_filter=True,  # 语音活动检测
        )
        
        return result['text'].strip()
    except Exception as e:
        logger.error(f"Whisper 转写失败: {e}")
        return None

def extract_audio(url: str, output_dir: str, max_duration: int = 60) -> Optional[str]:
    """
    下载视频并提取音频
    """
    logger.info(f"开始下载视频: {url}")
    
    output_path = os.path.join(output_dir, 'audio.mp3')
    
    try:
        # 用 yt-dlp 下载并转码为音频
        cmd = [
            'yt-dlp',
            '-f', 'bestaudio[ext=m4a]',  # 最佳音频格式
            '--max-filesize', '50M',      # 限制文件大小
            '--max-duration', str(max_duration),  # 限制时长
            '-x',                          # 提取音频
            '--audio-format', 'mp3',
            '--audio-quality', '5',        # 低质量，文件更小
            '-o', output_path,
            url
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180
        )
        
        logger.info(f"下载结果: {result.returncode}")
        
        if os.path.exists(output_path):
            return output_path
        else:
            logger.error(f"音频文件不存在: {output_path}")
            return None
            
    except subprocess.TimeoutExpired:
        logger.error("下载超时")
        return None
    except Exception as e:
        logger.error(f"下载失败: {e}")
        return None

@app.post("/extract", response_model=ExtractResponse)
async def extract_subtitle(request: ExtractRequest):
    """
    提取视频字幕接口
    
    优先级：
    1. 从缓存读取
    2. 用 yt-dlp 获取平台字幕
    3. 用 Whisper 转写音频
    """
    url = request.url
    
    # 1. 检查缓存
    if request.use_cache:
        cached = get_from_cache(url)
        if cached:
            return ExtractResponse(
                success=True,
                subtitles=cached,
                cached=True
            )
    
    # 2. 创建临时目录
    with tempfile.TemporaryDirectory() as tmp_dir:
        # 3. 优先用 yt-dlp 获取字幕
        subtitles, title, duration = extract_subtitle_with_ytdlp(url, tmp_dir)
        
        # 4. 如果没有字幕，降级使用 Whisper
        if not subtitles:
            logger.info("无字幕，降级使用 Whisper")
            
            # 下载音频
            audio_path = extract_audio(url, tmp_dir)
            
            if audio_path and os.path.exists(audio_path):
                subtitles = transcribe_with_whisper(audio_path)
        
        # 5. 如果仍然没有字幕，返回提示
        if not subtitles:
            return ExtractResponse(
                success=False,
                error="无法提取字幕内容，请手动输入文字描述"
            )
        
        # 6. 缓存结果
        if request.use_cache:
            save_to_cache(url, subtitles)
        
        return ExtractResponse(
            success=True,
            subtitles=subtitles,
            title=title,
            duration=duration,
            platform=detect_platform(url)
        )

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "model_loaded": model is not None}

@app.on_event("startup")
async def startup_event():
    """服务启动时初始化"""
    os.makedirs(cache_dir, exist_ok=True)
    init_model()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
