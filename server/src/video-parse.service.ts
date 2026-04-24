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
   * @param input 用户输入（可能包含文字和URL）
   * @returns 识别结果
   */
  async extractTextFromVideo(input: string): Promise<VideoParseResult> {
    console.log(`[VideoParse] 开始解析视频: ${input}`)

    // 1. 从输入中提取 URL
    const videoUrl = this.extractUrl(input)
    if (!videoUrl) {
      return {
        success: false,
        error: '未检测到有效的视频链接',
      }
    }

    console.log(`[VideoParse] 提取到 URL: ${videoUrl}`)

    // 2. 解析短链（xhslink.com -> 真实地址）
    const realUrl = await this.resolveShortUrl(videoUrl)
    if (!realUrl) {
      return {
        success: false,
        error: '短链接解析失败，请确保链接可访问',
      }
    }

    console.log(`[VideoParse] 解析后 URL: ${realUrl}`)

    let audioPath: string | null = null

    try {
      // 3. 检查 ASR 服务配置
      if (!this.asrService.isAvailable()) {
        return {
          success: false,
          error: 'ASR 服务未配置，请配置百度或讯飞 API',
        }
      }

      // 4. 提取音频
      console.log(`[VideoParse] 步骤1: 提取音频`)
      audioPath = await this.audioService.extractAudioFromUrl(realUrl)

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

  /**
   * 从文本中提取 URL
   */
  extractUrl(text: string): string | null {
    // 匹配 http/https 开头的 URL
    const urlPattern = /https?:\/\/[^\s\u4e00-\u9fa5（）！，。、;:：'""<>《》]+/gi
    const matches = text.match(urlPattern)
    
    if (matches && matches.length > 0) {
      // 返回第一个匹配的 URL
      return matches[0].replace(/[，。！、；：'""<>《》]+$/, '') // 去掉末尾的标点
    }
    
    return null
  }

  /**
   * 解析短链接为真实地址
   */
  async resolveShortUrl(shortUrl: string): Promise<string | null> {
    try {
      // 如果不是短链，直接返回
      if (!/xhslink\.com|b23\.tv|v\.douyin\.com/i.test(shortUrl)) {
        return shortUrl
      }

      console.log(`[VideoParse] 解析短链: ${shortUrl}`)

      // 使用 HEAD 请求跟随重定向获取真实地址
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(shortUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const realUrl = response.url
      console.log(`[VideoParse] 短链解析结果: ${realUrl}`)

      return realUrl
    } catch (error: any) {
      console.error(`[VideoParse] 短链解析失败:`, error.message)
      // 降级：返回原始 URL，让 yt-dlp 尝试处理
      return shortUrl
    }
  }
}

import * as fs from 'fs'
