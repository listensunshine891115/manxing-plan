/**
 * 视频解析服务
 * 整合视频下载、音频提取、ASR 转写
 */

import { Injectable } from '@nestjs/common'
import { AudioService } from './audio.service'
import { AsrService } from './asr.service'

export interface VideoParseResult {
  success: boolean
  text?: string
  error?: string
  source?: string
}

@Injectable()
export class VideoParseService {
  constructor(
    private readonly audioService: AudioService,
    private readonly asrService: AsrService,
  ) {}

  /**
   * 从视频 URL 提取字幕/文字
   * @param videoUrl 视频链接
   * @returns 识别结果
   */
  async extractTextFromVideo(videoUrl: string): Promise<VideoParseResult> {
    console.log(`[VideoParse] 开始解析视频: ${videoUrl}`)

    let audioPath: string | null = null

    try {
      // 1. 检查 ASR 服务配置
      if (!this.asrService.isAvailable()) {
        return {
          success: false,
          error: 'ASR 服务未配置，请配置百度或讯飞 API',
        }
      }

      // 2. 提取音频
      console.log(`[VideoParse] 步骤1: 提取音频`)
      audioPath = await this.audioService.extractAudioFromUrl(videoUrl)

      if (!audioPath || !fs.existsSync(audioPath)) {
        throw new Error('音频提取失败')
      }

      console.log(`[VideoParse] 音频已提取: ${audioPath}`)

      // 3. 调用 ASR 转写
      console.log(`[VideoParse] 步骤2: ASR 转写`)
      const text = await this.asrService.speechToText(audioPath)

      if (!text) {
        return {
          success: false,
          error: '语音识别失败，未获取到文字内容',
        }
      }

      console.log(`[VideoParse] 识别成功: ${text.substring(0, 100)}...`)

      return {
        success: true,
        text,
        source: 'video_asr',
      }
    } catch (error: any) {
      console.error(`[VideoParse] 解析失败:`, error)
      return {
        success: false,
        error: error.message || '视频解析失败',
      }
    } finally {
      // 4. 清理临时文件
      if (audioPath) {
        this.audioService.cleanup(audioPath)
      }
    }
  }

  /**
   * 检测是否为支持的视频平台
   */
  detectPlatform(url: string): string | null {
    const patterns = [
      { platform: 'xiaohongshu', patterns: [/xiaohongshu\.com/i, /xhslink\.com/i] },
      { platform: 'douyin', patterns: [/douyin\.com/i, /v\.douyin\.com/i] },
      { platform: 'bilibili', patterns: [/bilibili\.com/i, /b23\.tv/i] },
      { platform: 'weibo', patterns: [/weibo\.com/i, /video\.weibo\.com/i] },
    ]

    for (const { platform, patterns: ptn } of patterns) {
      if (ptn.some(pattern => pattern.test(url))) {
        return platform
      }
    }

    return null
  }
}

// 修复 import
import * as fs from 'fs'
