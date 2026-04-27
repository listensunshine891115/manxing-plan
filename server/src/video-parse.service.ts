/**
 * 视频解析服务
 * 整合视频下载、音频提取、ASR 转写
 */

import { Injectable } from '@nestjs/common'
import { AudioService } from './audio.service'
import { AsrService } from './asr.service'
import * as playwright from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

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

    // 2. 解析短链
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

      // 5. 调用 ASR 转写
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
      console.error(`[VideoParse] 解析失败:`, error.message)
      
      // 降级方案：使用 Playwright 获取小红书页面内容
      const platform = this.detectPlatform(realUrl)
      if (platform === 'xiaohongshu') {
        console.log(`[VideoParse] 尝试使用 Playwright 降级获取小红书内容`)
        const playwrightResult = await this.extractFromXiaoHongShuWithPlaywright(realUrl)
        if (playwrightResult.success && playwrightResult.text) {
          return playwrightResult
        }
      }
      
      return {
        success: false,
        error: error.message || '视频解析失败',
      }
    } finally {
      // 6. 清理临时文件
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
    const urlPattern = /https?:\/\/[^\s\u4e00-\u9fa5（）！，。、;:：'""<>《》]+/gi
    const matches = text.match(urlPattern)
    
    if (matches && matches.length > 0) {
      return matches[0].replace(/[，。！、；：'""<>《》]+$/, '')
    }
    
    return null
  }

  /**
   * 解析短链接为真实地址
   */
  async resolveShortUrl(shortUrl: string): Promise<string | null> {
    try {
      if (!/xhslink\.com|b23\.tv|v\.douyin\.com/i.test(shortUrl)) {
        return shortUrl
      }

      console.log(`[VideoParse] 解析短链: ${shortUrl}`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(shortUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response.url
    } catch (error: any) {
      console.error(`[VideoParse] 短链解析失败:`, error.message)
      return shortUrl
    }
  }

  /**
   * 使用 Playwright 获取小红书页面内容（降级方案）
   */
  private async extractFromXiaoHongShuWithPlaywright(url: string): Promise<VideoParseResult> {
    let browser: playwright.Browser | null = null
    try {
      console.log(`[VideoParse] Playwright 降级：获取小红书内容: ${url}`)
      
      browser = await playwright.chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      })
      const page = await browser.newPage()
      
      await page.setViewportSize({ width: 375, height: 812 })
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      })
      
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(3000)
      
      const content = await page.evaluate(() => {
        const selectors = [
          '.note-content', '.note-detail-content', '#detail-content',
          '.content', '.main-content', 'article', 'main',
          '[class*="desc"]', '[class*="note"]', '[class*="detail"]'
        ]
        
        let mainContent = ''
        for (const selector of selectors) {
          const el = document.querySelector((selector as string)) as HTMLElement | null
          if (el) {
            const text = el.innerText || el.textContent || ''
            if (text.length > mainContent.length) {
              mainContent = text
            }
          }
        }
        
        if (!mainContent || mainContent.length < 50) {
          mainContent = document.body.innerText || document.body.textContent || ''
        }
        
        mainContent = mainContent.replace(/\s+/g, ' ').trim()
        
        if (mainContent.length > 5000) {
          mainContent = mainContent.slice(0, 5000)
        }
        
        return mainContent
      })
      
      console.log(`[VideoParse] Playwright 降级获取内容长度: ${content.length}`)
      
      if (content && content.length > 20) {
        return {
          success: true,
          text: content,
          source: 'xiaohongshu_playwright',
        }
      }
      
      return {
        success: false,
        error: '无法获取小红书内容',
      }
    } catch (error: any) {
      console.error(`[VideoParse] Playwright 降级失败:`, error.message)
      return {
        success: false,
        error: error.message || 'Playwright 降级失败',
      }
    } finally {
      if (browser) {
        await browser.close().catch(() => {})
      }
    }
  }
}
