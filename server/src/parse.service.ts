import { Injectable } from '@nestjs/common'
import { FetchClient, LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { AsrService } from './asr.service'
import { AudioService } from './audio.service'
import { VideoParseService } from './video-parse.service'
import { execSync } from 'child_process'
import * as playwright from 'playwright'

// 类型映射：中文 -> 中文一级标签
const primaryTagMap: Record<string, string> = {
  '景点': '景点',
  '景区': '景点',
  '博物馆': '景点',
  '美食': '美食',
  '餐厅': '美食',
  '小吃': '美食',
  '饮品': '美食',
  '咖啡': '美食',
  '默认': '景点',
}

function normalizePrimaryTag(tag: string): string {
  if (!tag) return '景点'
  return primaryTagMap[tag] || tag || '景点'
}

// 解析后的灵感数据
export interface ParsedInspiration {
  name: string
  location: string
  time: string
  primaryTag: string
  secondaryTag: string
  price: string
  description: string
  source: string
  url: string
  coverImage: string
  tags: string[]
}

// 来源类型
export type SourceType = 'video' | 'ticket' | 'merchant' | 'article' | 'text'

@Injectable()
export class ParseService {
  private get client() {
    return getSupabaseClient()
  }

  private fetchClient: FetchClient
  private llmClient: LLMClient
  private videoParseService: VideoParseService

  // GPU 服务器地址（AutoDL - 已废弃，使用本地 ASR）
  private gpuServerUrl = process.env.GPU_SERVER_URL

  constructor(
    private readonly asrService: AsrService,
    private readonly audioService: AudioService,
  ) {
    const config = new Config()
    
    this.fetchClient = new FetchClient(config)
    this.llmClient = new LLMClient(config)
    this.videoParseService = new VideoParseService(this.audioService, this.asrService)
  }

  // 主解析入口
  async parse(
    userId: string,
    input: { url?: string; text?: string }
  ): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      console.log(`[Parse] 开始解析 - userId: ${userId}, input:`, JSON.stringify(input))

      let sourceType: SourceType
      let content: string
      let url: string
      let title: string
      let coverImage: string

      // 从输入中提取 URL
      const extractedUrl = this.extractUrl(input.url || input.text || '')

      // 判断输入类型
      if (extractedUrl && extractedUrl.includes('http')) {
        url = extractedUrl
        sourceType = this.detectSourceType(url)

        // 判断是否为短视频平台
        if (sourceType === 'video') {
          // 短视频平台：先解析短链接
          const realUrl = await this.resolveShortUrl(url)
          if (realUrl && realUrl !== url) {
            console.log(`[Parse] 短链接已解析: ${url} -> ${realUrl}`)
            url = realUrl
          }

          // 短视频平台：优先用 GPU 服务提取字幕
          const subtitleResult = await this.extractVideoSubtitle(url)
          
          if (subtitleResult) {
            // 获取到字幕，使用字幕内容
            content = subtitleResult
            title = '' // 可以从字幕进一步提取
          } else {
            // 降级1：尝试用 yt-dlp 获取视频信息
            const ytDlpResult = await this.getVideoInfoWithYtDlp(url)
            if (ytDlpResult.success) {
              content = ytDlpResult.description || ytDlpResult.title || ''
              title = ytDlpResult.title || '未命名'
              coverImage = ytDlpResult.thumbnail || ''
            } else {
              // 降级2：用 fetch 获取页面内容（可能失败）
              const fetchResult = await this.fetchUrl(url)
              if (!fetchResult.success) {
                // 降级3：直接返回原始文字内容
                return {
                  success: true,
                  data: {
                    name: this.extractTextFromInput(input.url || input.text || ''),
                    source: '社交短视频平台',
                    type: '视频',
                    location_name: '',
                    time: '',
                    price: '',
                    description: input.url || input.text || '',
                    tags: [],
                    original_url: url,
                  },
                  message: '已收录，但未能获取详细信息'
                }
              }
              content = fetchResult.content || ''
              title = fetchResult.title || '未命名'
              coverImage = fetchResult.coverImage || ''
            }
          }
        } else {
          // 其他平台：用 fetch 获取内容
          const fetchResult = await this.fetchUrl(url)
          
          if (!fetchResult.success) {
            return { success: false, message: fetchResult.message || '获取页面失败' }
          }

          content = fetchResult.content || ''
          title = fetchResult.title || '未命名'
        }
        
        coverImage = '' // 可以从 fetch 或 GPU 服务获取
      } else if (input.text) {
        // 直接拷贝文字
        content = input.text
        url = ''
        title = ''
        coverImage = ''
        sourceType = 'text'
      } else {
        return { success: false, message: '请输入链接或文字内容' }
      }

      // 使用 LLM 提取关键信息
      const parsed = await this.extractWithLLM(content, sourceType, title)

      // 保存到数据库
      const saved = await this.saveInspiration({
        user_id: userId,
        title: parsed.name,
        image: parsed.coverImage,
        source: parsed.source,
        primary_tag: normalizePrimaryTag(parsed.primaryTag),  // 转换一级标签
        secondary_tag: parsed.secondaryTag,  // 二级标签
        location: parsed.location,
        time: parsed.time,
        price: parsed.price,
        description: parsed.description,
        original_url: parsed.url,
        tags: parsed.tags
      })

      console.log(`[Parse] 解析成功 - title: ${parsed.name}`)

      return {
        success: true,
        data: {
          ...parsed,
          id: saved.id,
          create_time: saved.create_time
        },
        message: `已收录「${parsed.name}」到灵感库`
      }
    } catch (error: any) {
      console.error(`[Parse] 解析失败:`, error)
      return { success: false, message: `解析失败: ${error.message}` }
    }
  }

  // 预览多个灵感点
  async previewMultiple(
    userId: string,
    input: { url?: string; text?: string }
  ): Promise<{
    success: boolean
    data?: {
      totalCount: number
      inspirationPoints: any[]
      summary: string
      sourceUrl: string
    }
    message?: string
  }> {
    try {
      console.log(`[Parse] 预览多个灵感点 - userId: ${userId}`)

      let content = ''
      let title = ''
      let sourceUrl = input.url || ''
      let sourceType: SourceType = 'article'

      // 提取 URL 和保留文本部分
      let originalText = ''
      if (input.url) {
        const extractedUrl = this.extractUrl(input.url || '')
        if (extractedUrl) {
          sourceUrl = extractedUrl
          sourceType = this.detectSourceType(sourceUrl)
          // 保留 URL 前后的文本部分，用于降级
          originalText = input.url.replace(extractedUrl, '').trim()
          console.log(`[Parse] 提取到 URL: ${sourceUrl}, 原文文本: ${originalText}`)
        } else {
          sourceUrl = ''
        }
      }
      
      // 如果有纯文本输入，也保留
      if (input.text) {
        originalText = originalText ? `${originalText} ${input.text}` : input.text
      }

      // 根据来源类型获取内容
      if (sourceUrl) {
        if (sourceType === 'video') {
          // 视频类型：先解析短链接
          const realUrl = await this.resolveShortUrl(sourceUrl)
          if (realUrl && realUrl !== sourceUrl) {
            console.log(`[Parse] previewMultiple 短链接已解析: ${sourceUrl} -> ${realUrl}`)
            sourceUrl = realUrl
          }

          // 视频类型：提取字幕
          const subtitleResult = await this.extractVideoSubtitle(sourceUrl)
          
          if (subtitleResult) {
            content = subtitleResult
          } else {
            // 降级1：用 yt-dlp 获取信息
            const ytDlpResult = await this.getVideoInfoWithYtDlp(sourceUrl)
            if (ytDlpResult.success) {
              content = ytDlpResult.description || ytDlpResult.title || ''
              title = ytDlpResult.title || '未命名'
            } else {
              // 降级2：尝试从输入文字中提取内容
              if (input.text) {
                const textContent = this.extractTextFromInput(input.text)
                if (textContent) {
                  console.log(`[Parse] 视频获取失败，降级使用输入文字`)
                  content = textContent
                  title = ''
                  sourceType = 'text'
                } else {
                  return { success: false, message: '无法获取视频内容' }
                }
              } else {
                return { success: false, message: '无法获取视频内容' }
              }
            }
          }
        } else {
          // 其他类型：fetch 获取内容
          const fetchResult = await this.fetchUrl(sourceUrl)
          if (!fetchResult.success) {
            // 降级1：尝试从输入文字中提取内容
            if (input.text) {
              const textContent = this.extractTextFromInput(input.text)
              if (textContent) {
                console.log(`[Parse] fetchUrl 失败，降级使用输入文字`)
                content = textContent
                title = ''
                sourceType = 'text'
              } else {
                return { success: false, message: fetchResult.message || '获取页面失败' }
              }
            } else {
              return { success: false, message: fetchResult.message || '获取页面失败' }
            }
          } else {
            content = fetchResult.content || ''
            title = fetchResult.title || ''
            
            // 检测是否为无效页面（如需要登录、引流提示等）
            const isInvalidPage = 
              content.length < 50 || // 内容太短
              title.includes('登录') || title.includes('error') || // 登录页或错误页
              content.includes('App') || content.includes('打开') || // 引流提示
              !content.match(/[\u4e00-\u9fa5]{4,}/) // 没有足够的中文内容
            
            // 如果是无效页面，且有原始文本，降级使用
            if (isInvalidPage && originalText) {
              const textContent = this.extractTextFromInput(originalText)
              if (textContent && textContent.length > 0) {
                console.log(`[Parse] 检测到无效页面（内容${content.length}字符），降级使用原始文本（${textContent.length}字符）`)
                content = textContent
                title = ''
                sourceType = 'text'
              }
            }
          }
        }
      } else if (originalText) {
        // 直接输入文字
        content = this.extractTextFromInput(originalText)
        title = ''
        sourceType = 'text'
      } else if (input.text) {
        // 直接输入文字（fallback）
        content = this.extractTextFromInput(input.text)
        title = ''
        sourceType = 'text'
      } else {
        return { success: false, message: '请提供 url 或 text 参数' }
      }

      if (!content) {
        return { success: false, message: '未能获取到内容' }
      }

      console.log(`[Parse] 开始分析内容，长度: ${content.length}`)

      // 调用 LLM 提取多个灵感点（使用默认模型）
      const prompt = this.buildMultiExtractPrompt(content, sourceType, title, sourceUrl)
      
      let response: any = null
      try {
        response = await this.llmClient.invoke(
          [{ role: 'user', content: prompt }],
          {
            temperature: 0.7
          }
        )
        console.log(`[Parse] LLM 响应:`, JSON.stringify(response).slice(0, 500))
      } catch (llmError: any) {
        console.error(`[Parse] LLM 调用失败:`, llmError.message)
        return { success: false, message: `LLM 服务暂不可用: ${llmError.message}` }
      }

      // 解析 LLM 返回
      let responseContent = ''
      if (typeof response === 'string') {
        responseContent = response
      } else if (response?.content) {
        if (typeof response.content === 'string') {
          responseContent = response.content
        } else if (Array.isArray(response.content)) {
          for (const item of response.content) {
            if (item?.type === 'text' && item?.text) {
              responseContent = item.text
              break
            }
          }
        } else if (response.content?.text) {
          responseContent = response.content.text
        }
      } else if (response?.text) {
        responseContent = response.text
      } else {
        try {
          responseContent = JSON.stringify(response)
        } catch {
          responseContent = String(response)
        }
      }
      
      console.log(`[Parse] LLM 响应内容前200字: ${responseContent.slice(0, 200)}`)

      // 解析 LLM 返回的 JSON
      const result = this.parseMultiLLMResponse(responseContent)

      console.log(`[Parse] 提取到 ${result.inspirationPoints.length} 个灵感点`)

      return {
        success: true,
        data: {
          totalCount: result.inspirationPoints.length,
          inspirationPoints: result.inspirationPoints.map((point: any) => ({
            ...point,
            sourceUrl: sourceUrl,
            selected: true, // 默认全部选中
          })),
          summary: result.summary,
          sourceUrl: sourceUrl
        },
        message: `从内容中提取到 ${result.inspirationPoints.length} 个灵感点`
      }
    } catch (error: any) {
      console.error(`[Parse] 预览失败:`, error)
      return { success: false, message: `预览失败: ${error.message}` }
    }
  }

  // 解析多个灵感点的 LLM 返回
  private parseMultiLLMResponse(content: string): {
    totalCount: number
    inspirationPoints: any[]
    summary: string
  } {
    try {
      // 尝试直接解析
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      
      if (!jsonMatch) {
        // 尝试修复 JSON 并重新解析
        const fixedContent = this.fixJSON(content)
        if (fixedContent) {
          const parsed = JSON.parse(fixedContent)
          return {
            totalCount: parsed.totalCount || parsed.inspirationPoints?.length || 0,
            inspirationPoints: parsed.inspirationPoints || [],
            summary: parsed.summary || ''
          }
        }
        return {
          totalCount: 0,
          inspirationPoints: [],
          summary: content.slice(0, 200) || '无法解析内容'
        }
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      return {
        totalCount: parsed.totalCount || parsed.inspirationPoints?.length || 0,
        inspirationPoints: parsed.inspirationPoints || [],
        summary: parsed.summary || ''
      }
    } catch (error) {
      console.error(`[Parse] 解析多个灵感点失败，尝试容错:`, error)
      
      // 容错：尝试从文本中提取灵感点
      const fallbackResult = this.extractInspirationPointsFallback(content)
      if (fallbackResult.inspirationPoints.length > 0) {
        return fallbackResult
      }
      
      return {
        totalCount: 0,
        inspirationPoints: [],
        summary: content.slice(0, 200) || '解析失败'
      }
    }
  }
  
  // 修复常见 JSON 格式问题
  private fixJSON(content: string): string | null {
    try {
      // 移除 markdown 代码块标记
      let fixed = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '')
      
      // 尝试找到 JSON 对象的开始和结束
      const startIndex = fixed.indexOf('{')
      const endIndex = fixed.lastIndexOf('}')
      
      if (startIndex === -1 || endIndex === -1) {
        return null
      }
      
      fixed = fixed.slice(startIndex, endIndex + 1)
      
      // 移除单引号，将 property 名用双引号包裹
      // 简单的修复：移除尾部的多余文本
      const lastValidIndex = fixed.lastIndexOf('}')
      if (lastValidIndex < fixed.length - 1) {
        fixed = fixed.slice(0, lastValidIndex + 1)
      }
      
      // 尝试解析
      JSON.parse(fixed)
      return fixed
    } catch {
      return null
    }
  }
  
  // 从文本中提取灵感点的容错方法
  private extractInspirationPointsFallback(content: string): {
    totalCount: number
    inspirationPoints: any[]
    summary: string
  } {
    const points: any[] = []
    
    // 尝试匹配灵感点名称（常见的模式）
    const namePatterns = [
      /["']?name["']?\s*[:：]\s*["']([^"']+)["']/gi,
      /^\d+[.、]\s*(.+?)(?=\n|$)/gm,
      /【([^】]+)】/g,
    ]
    
    for (const pattern of namePatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1].trim()
        if (name && name.length > 2 && name.length < 50) {
          points.push({
            name,
            location: '',
            time: '',
            primaryTag: '景点',
            secondaryTag: '网红打卡点',
            price: '',
            description: name,
            tags: [],
            highlights: [],
            sourceUrl: '',
            selected: true
          })
        }
      }
    }
    
    // 提取摘要（取前200字符）
    const summary = content.replace(/\n+/g, ' ').slice(0, 200)
    
    return {
      totalCount: points.length,
      inspirationPoints: points.slice(0, 10), // 最多返回10个
      summary
    }
  }

  // 使用本地 ASR 服务提取视频字幕（百度/讯飞）
  private async extractVideoSubtitle(url: string): Promise<string | null> {
    try {
      console.log(`[Parse] 使用本地 ASR 服务提取字幕: ${url}`)

      // 使用 VideoParseService 提取字幕
      const result = await this.videoParseService.extractTextFromVideo(url)

      if (result.success && result.text) {
        console.log(`[Parse] 字幕提取成功，长度: ${result.text.length}`)
        return result.text
      }

      console.log(`[Parse] 字幕提取失败: ${result.error}`)
      return null
    } catch (error: any) {
      console.error(`[Parse] 字幕提取失败:`, error)
      return null
    }
  }

  // 使用 yt-dlp 获取视频信息（降级方案）
  private async getVideoInfoWithYtDlp(url: string): Promise<{
    success: boolean
    title?: string
    description?: string
    thumbnail?: string
    message?: string
  }> {
    try {
      console.log(`[Parse] 使用 yt-dlp 获取视频信息: ${url}`)

      // 使用 yt-dlp 获取视频信息（不下载）
      const cmd = `yt-dlp --dump-json --no-download --no-playlist "${url}"`
      const output = execSync(cmd, { stdio: 'pipe', shell: '/bin/bash', timeout: 30000 })
      const info = JSON.parse(output.toString())

      return {
        success: true,
        title: info.title || '',
        description: info.description || '',
        thumbnail: info.thumbnail || '',
      }
    } catch (error: any) {
      console.error(`[Parse] yt-dlp 获取视频信息失败:`, error.message)
      return {
        success: false,
        message: `获取视频信息失败: ${error.message}`
      }
    }
  }

  // 解析短链接为真实 URL（使用 curl 确保正确跟随重定向）
  private async resolveShortUrl(shortUrl: string): Promise<string | null> {
    try {
      // 如果不是短链，直接返回原 URL
      if (!/xhslink\.com|b23\.tv|v\.douyin\.com|dpurl\.cn/i.test(shortUrl)) {
        return shortUrl
      }

      console.log(`[Parse] 使用 curl 解析短链: ${shortUrl}`)

      // 使用 curl 获取最终的 Location 头（使用 GET 而非 HEAD，因为服务器对 HEAD 返回 404）
      const cmd = `curl -s -L -w "\\n%{url_effective}" -o /dev/null "${shortUrl}" 2>&1 | tail -1`
      const output = execSync(cmd, { stdio: 'pipe', shell: '/bin/bash', timeout: 15000 }).toString().trim()

      if (output && output.startsWith('http')) {
        console.log(`[Parse] 短链解析成功: ${shortUrl} -> ${output}`)
        return output
      }

      // 备选方案：使用 curl -v 获取 Location
      const cmd2 = `curl -v -L "${shortUrl}" 2>&1 | grep "< Location" | tail -1 | sed 's/< Location: //' | tr -d '\\r'`
      const output2 = execSync(cmd2, { stdio: 'pipe', shell: '/bin/bash', timeout: 15000 }).toString().trim()

      if (output2 && output2.startsWith('http')) {
        console.log(`[Parse] 短链解析成功(备选): ${shortUrl} -> ${output2}`)
        return output2
      }

      console.log(`[Parse] 短链解析失败，未获取到有效 URL`)
      return shortUrl
    } catch (error: any) {
      console.error(`[Parse] 短链解析异常: ${error.message}`)
      // 降级：返回原始 URL，让后续流程尝试处理
      return shortUrl
    }
  }

  // 使用 fetch-url 获取页面内容
  private async fetchUrl(url: string): Promise<{
    success: boolean
    content?: string
    title?: string
    coverImage?: string
    imageUrls?: string[]
    message?: string
  }> {
    try {
      console.log(`[Parse] Fetch URL: ${url}`)
      
      // 先解析短链接（如果需要）
      let realUrl = url
      if (url.includes('xhslink.com')) {
        try {
          const resolved = await this.resolveShortUrl(url)
          if (resolved) {
            realUrl = resolved
            console.log(`[Parse] 短链接解析: ${url} -> ${realUrl}`)
          }
        } catch (e) {
          console.log(`[Parse] 短链接解析失败，使用原链接`)
        }
      }
      
      // 判断是否为微信公众号文章
      const isWeChatArticle = realUrl.includes('mp.weixin.qq.com')
      
      // 微信公众号文章使用 Playwright 获取
      if (isWeChatArticle) {
        return await this.fetchWeChatArticle(realUrl)
      }
      
      // 判断是否为小红书（使用 Playwright 获取）
      const isXiaoHongShu = realUrl.includes('xiaohongshu.com') || realUrl.includes('xhslink.com')
      
      if (isXiaoHongShu) {
        return await this.fetchXiaoHongShu(realUrl)
      }
      
      // 判断是否为票务平台
      const lowerUrl = realUrl.toLowerCase()
      const isTicketPlatform = 
        lowerUrl.includes('damai.cn') ||
        lowerUrl.includes('dmai.cn') ||
        lowerUrl.includes('piaoniu.com') ||
        lowerUrl.includes('maoyan.com') ||
        lowerUrl.includes('gewara.com') ||
        lowerUrl.includes('yongzhou.cn') ||
        lowerUrl.includes('shoukatsutravel') ||
        lowerUrl.includes('ch住') ||
        lowerUrl.includes('migu.cn') ||
        lowerUrl.includes('music.163.com') ||
        lowerUrl.includes('y.qq.com') ||
        lowerUrl.includes('ticket') ||
        lowerUrl.includes('票务') ||
        lowerUrl.includes('演唱会') ||
        lowerUrl.includes('音乐会') ||
        lowerUrl.includes('戏剧')
      
      // 票务平台使用 Playwright 获取
      if (isTicketPlatform) {
        return await this.fetchTicketPlatform(realUrl)
      }
      
      // 判断是否为大众点评/美团
      const isDianPing = 
        lowerUrl.includes('dianping.com') ||
        lowerUrl.includes('dpurl.cn') ||
        lowerUrl.includes('meituan.com')
      
      // 大众点评使用 Playwright 获取
      if (isDianPing) {
        return await this.fetchDianPing(realUrl)
      }
      
      // 其他网站使用 fetchClient
      const response = await this.fetchClient.fetch(realUrl)
      console.log(`[Parse] fetchClient.fetch 结果:`, JSON.stringify(response).slice(0, 500))

      if (response.status_code !== 0) {
        return {
          success: false,
          message: `获取页面失败: ${response.status_message || '未知错误'}`
        }
      }

      // 提取纯文本内容
      const textContent = response.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n')
        .slice(0, 5000) // 限制内容长度

      // 提取封面图
      let coverImage = ''
      const firstImage = response.content.find(item => item.type === 'image')
      if (firstImage?.image?.display_url) {
        coverImage = firstImage.image.display_url
      }
      
      // 提取所有图片 URL
      const imageUrls: string[] = response.content
        .filter(item => item.type === 'image' && item.image?.display_url)
        .map(item => item.image!.display_url as string)

      return {
        success: true,
        content: textContent,
        title: response.title || '',
        coverImage,
        imageUrls
      }
    } catch (error: any) {
      console.error(`[Parse] Fetch 失败:`, error)
      return { success: false, message: `获取页面失败: ${error.message}` }
    }
  }
  
  // 专门获取微信公众号文章内容（使用 Playwright 渲染）
  private async fetchWeChatArticle(url: string): Promise<{
    success: boolean
    content?: string
    title?: string
    coverImage?: string
    imageUrls?: string[]
    message?: string
  }> {
    let browser: playwright.Browser | null = null
    try {
      console.log(`[Parse] 微信公众号文章，使用 Playwright 渲染获取: ${url}`)
      
      // 使用 Playwright 启动无头浏览器
      browser = await playwright.chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      const page = await browser.newPage()
      
      // 设置视口和用户代理
      await page.setViewportSize({ width: 375, height: 812 })
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      })
      
      // 访问页面并等待内容加载
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
      
      // 等待正文内容加载
      await page.waitForSelector('#js_content', { timeout: 10000 }).catch(() => {
        console.log(`[Parse] 等待 #js_content 超时，继续尝试获取内容`)
      })
      
      // 获取标题
      const title = await page.title()
      console.log(`[Parse] 公众号文章标题: ${title}`)
      
      // 获取正文内容
      const content = await page.evaluate(() => {
        const contentEl = document.getElementById('js_content')
        if (!contentEl) return ''
        
        // 获取纯文本内容
        let text = contentEl.innerText || contentEl.textContent || ''
        
        // 清理文本
        text = text.replace(/\s+/g, ' ').trim()
        
        // 限制长度
        if (text.length > 5000) {
          text = text.slice(0, 5000)
        }
        
        return text
      })
      
      console.log(`[Parse] 公众号文章正文长度: ${content.length}`)
      
      // 获取所有图片 URL
      const imageUrls = await page.evaluate(() => {
        const contentEl = document.getElementById('js_content')
        if (!contentEl) return []
        
        const images = contentEl.querySelectorAll('img')
        const urls: string[] = []
        
        images.forEach((img) => {
          // 优先使用 data-src（懒加载图片）
          let src = img.getAttribute('data-src') || img.src || ''
          
          // 过滤掉表情包等小图（通常包含 qpic.cn 的很小）
          if (src && !src.includes('qpic.cn')) {
            urls.push(src)
          }
        })
        
        return urls
      })
      
      console.log(`[Parse] 公众号文章图片数量: ${imageUrls.length}`)
      
      // 获取封面图
      const coverImage = await page.evaluate(() => {
        // 尝试从 meta 标签获取 og:image
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content')
        if (ogImage) return ogImage
        
        // 或者从第一个大图获取
        const contentEl = document.getElementById('js_content')
        if (contentEl) {
          const firstImg = contentEl.querySelector('img')
          if (firstImg) {
            return firstImg.getAttribute('data-src') || firstImg.src || ''
          }
        }
        
        return ''
      })
      
      if (!content) {
        return { success: false, message: '无法提取文章正文内容' }
      }
      
      return {
        success: true,
        content,
        title,
        coverImage,
        imageUrls
      }
    } catch (error: any) {
      console.error(`[Parse] 微信公众号 Playwright 获取失败:`, error.message)
      return { success: false, message: `获取公众号文章失败: ${error.message}` }
    } finally {
      // 确保浏览器被关闭
      if (browser) {
        await browser.close().catch(() => {})
      }
    }
  }

  // 专门获取小红书内容（使用 Playwright 渲染）
  private async fetchXiaoHongShu(url: string): Promise<{
    success: boolean
    content?: string
    title?: string
    coverImage?: string
    imageUrls?: string[]
    message?: string
  }> {
    let browser: playwright.Browser | null = null
    try {
      console.log(`[Parse] 小红书内容，使用 Playwright 渲染获取: ${url}`)
      
      // 先解析短链接
      let realUrl = url
      if (url.includes('xhslink.com')) {
        try {
          const resolved = await this.resolveShortUrl(url)
          if (resolved) {
            realUrl = resolved
            console.log(`[Parse] 小红书短链接解析: ${url} -> ${realUrl}`)
          }
        } catch (e) {
          console.log(`[Parse] 小红书短链接解析失败`)
        }
      }
      
      // 使用 Playwright 启动无头浏览器
      browser = await playwright.chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      })
      const page = await browser.newPage()
      
      // 设置视口和用户代理（移动端）
      await page.setViewportSize({ width: 375, height: 812 })
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      })
      
      // 访问页面并等待内容加载
      await page.goto(realUrl, { waitUntil: 'networkidle', timeout: 30000 })
      
      // 等待页面主要元素加载
      await page.waitForTimeout(3000)
      
      // 获取标题
      const title = await page.title()
      console.log(`[Parse] 小红书标题: ${title}`)
      
      // 获取正文内容
      const content = await page.evaluate(() => {
        // 小红书的主要内容可能在多个位置
        const selectors = [
          // PC端
          '.note-content', '.note-detail-content', '#detail-content',
          '.content', '.main-content',
          // 移动端
          '.swiper-slide', '.note-swiper',
          // 通用
          'article', '.article', 'main', '[class*="content"]',
          // 描述区域
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
        
        // 如果没找到，尝试获取 body
        if (!mainContent || mainContent.length < 50) {
          mainContent = document.body.innerText || document.body.textContent || ''
        }
        
        // 清理文本
        mainContent = mainContent.replace(/\s+/g, ' ').trim()
        
        // 限制长度
        if (mainContent.length > 5000) {
          mainContent = mainContent.slice(0, 5000)
        }
        
        return mainContent
      })
      
      console.log(`[Parse] 小红书内容长度: ${content.length}`)
      
      // 获取页面中的图片
      const imageUrls = await page.evaluate(() => {
        const images = document.querySelectorAll('img')
        const urls: string[] = []
        
        images.forEach((img) => {
          let src = img.getAttribute('data-src') || img.getAttribute('src') || ''
          // 过滤掉空白图、logo、icon 等
          if (src && !src.includes('logo') && !src.includes('icon') && 
              !src.includes('avatar') && !src.includes('avatar') &&
              src.length > 100) {
            urls.push(src)
          }
        })
        
        return urls.slice(0, 10) // 最多取10张图片
      })
      
      console.log(`[Parse] 小红书图片数量: ${imageUrls.length}`)
      
      // 获取封面图
      const coverImage = imageUrls.length > 0 ? imageUrls[0] : ''
      
      if (!content || content.length < 10) {
        // 降级：尝试获取 meta 描述
        const metaDesc = await page.evaluate(() => {
          const meta = document.querySelector('meta[name="description"]')
          return meta?.getAttribute('content') || ''
        })
        
        if (metaDesc) {
          return {
            success: true,
            content: metaDesc,
            title,
            coverImage,
            imageUrls
          }
        }
        
        return { success: false, message: '无法提取小红书内容' }
      }
      
      return {
        success: true,
        content,
        title,
        coverImage,
        imageUrls
      }
    } catch (error: any) {
      console.error(`[Parse] 小红书 Playwright 获取失败:`, error.message)
      return { success: false, message: `获取小红书内容失败: ${error.message}` }
    } finally {
      if (browser) {
        await browser.close().catch(() => {})
      }
    }
  }

  // 专门获取票务平台内容（使用 Playwright 渲染）
  private async fetchTicketPlatform(url: string): Promise<{
    success: boolean
    content?: string
    title?: string
    coverImage?: string
    imageUrls?: string[]
    message?: string
  }> {
    let browser: playwright.Browser | null = null
    try {
      console.log(`[Parse] 票务平台内容，使用 Playwright 渲染获取: ${url}`)
      
      // 使用 Playwright 启动无头浏览器
      browser = await playwright.chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      const page = await browser.newPage()
      
      // 设置视口和用户代理
      await page.setViewportSize({ width: 375, height: 812 })
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      })
      
      // 访问页面并等待内容加载
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
      
      // 等待页面主要元素加载
      await page.waitForTimeout(2000) // 等待动态内容渲染
      
      // 获取标题
      const title = await page.title()
      console.log(`[Parse] 票务平台标题: ${title}`)
      
      // 获取页面主要内容
      const content = await page.evaluate(() => {
        // 尝试多种选择器获取主要内容
        const selectors = [
          'main', '.main-content', '.event-detail', '.product-info',
          '[class*="content"]', '[class*="detail"]', '[class*="info"]',
          'article', '.article', '#content', '#main'
        ]
        
        let mainContent = ''
        for (const selector of selectors) {
          const el = document.querySelector(selector) as HTMLElement | null
          if (el) {
            const text = el.innerText || el.textContent || ''
            if (text.length > mainContent.length) {
              mainContent = text
            }
          }
        }
        
        // 如果没找到，尝试获取 body
        if (!mainContent || mainContent.length < 50) {
          mainContent = document.body.innerText || document.body.textContent || ''
        }
        
        // 清理文本
        mainContent = mainContent.replace(/\s+/g, ' ').trim()
        
        // 限制长度
        if (mainContent.length > 5000) {
          mainContent = mainContent.slice(0, 5000)
        }
        
        return mainContent
      })
      
      console.log(`[Parse] 票务平台内容长度: ${content.length}`)
      
      // 获取页面中的图片
      const imageUrls = await page.evaluate(() => {
        const images = document.querySelectorAll('img')
        const urls: string[] = []
        
        images.forEach((img) => {
          let src = img.getAttribute('data-src') || img.getAttribute('src') || ''
          // 过滤掉空白图、logo、icon 等
          if (src && !src.includes('logo') && !src.includes('icon') && src.length > 50) {
            urls.push(src)
          }
        })
        
        return urls.slice(0, 10) // 最多取10张图片
      })
      
      console.log(`[Parse] 票务平台图片数量: ${imageUrls.length}`)
      
      // 获取封面图（通常是第一张大图）
      const coverImage = imageUrls.length > 0 ? imageUrls[0] : ''
      
      if (!content) {
        return { success: false, message: '无法提取票务页面内容' }
      }
      
      return {
        success: true,
        content,
        title,
        coverImage,
        imageUrls
      }
    } catch (error: any) {
      console.error(`[Parse] 票务平台 Playwright 获取失败:`, error.message)
      return { success: false, message: `获取票务信息失败: ${error.message}` }
    } finally {
      // 确保浏览器被关闭
      if (browser) {
        await browser.close().catch(() => {})
      }
    }
  }

  // 专门获取大众点评内容（使用 Playwright 渲染）
  private async fetchDianPing(url: string): Promise<{
    success: boolean
    content?: string
    title?: string
    coverImage?: string
    imageUrls?: string[]
    relatedLinks?: string[]
    message?: string
  }> {
    let browser: playwright.Browser | null = null
    try {
      console.log(`[Parse] 大众点评内容，使用 Playwright 渲染获取: ${url}`)
      
      // 解析短链接
      let realUrl = url
      if (url.includes('dpurl.cn')) {
        try {
          const resolved = await this.resolveShortUrl(url)
          if (resolved) {
            realUrl = resolved
            console.log(`[Parse] 短链接解析: ${url} -> ${realUrl}`)
          }
        } catch (e) {
          console.log(`[Parse] 短链接解析失败，使用原链接`)
        }
      }
      
      // 使用 Playwright 启动无头浏览器
      browser = await playwright.chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      const page = await browser.newPage()
      
      // 设置视口和用户代理（移动端）
      await page.setViewportSize({ width: 375, height: 812 })
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      })
      
      // 访问页面并等待内容加载
      await page.goto(realUrl, { waitUntil: 'networkidle', timeout: 20000 })
      
      // 等待页面主要元素加载
      await page.waitForTimeout(3000)
      
      // 获取标题（店铺名称）
      const title = await page.title()
      console.log(`[Parse] 大众点评标题: ${title}`)
      
      // 获取页面主要内容
      let content = await page.evaluate(() => {
        // 尝试多种选择器获取店铺信息
        const selectors = [
          // 店铺信息区域
          '[class*="shop-info"]', '[class*="shopInfo"]',
          '[class*="shop-detail"]', '[class*="shopDetail"]',
          // 评价区域
          '[class*="comment"]', '[class*="review"]',
          // 主内容区
          'main', '.main-content', '#content',
          // 商品信息
          '[class*="product"]', '[class*="deal"]',
          // 移动端特定
          '[class*="shop-base"]', '[class*="shopBase"]',
          // feed 内容（UGC 内容）
          '[class*="feed"]', '[class*="feedContent"]',
          '[class*="ugc"]', '[class*="ugcContent"]',
        ]
        
        let mainContent = ''
        for (const selector of selectors) {
          const el = document.querySelector(selector) as HTMLElement | null
          if (el) {
            const text = el.innerText || el.textContent || ''
            if (text.length > mainContent.length) {
              mainContent = text
            }
          }
        }
        
        // 如果没找到，尝试获取 body
        if (!mainContent || mainContent.length < 50) {
          mainContent = document.body.innerText || document.body.textContent || ''
        }
        
        // 清理文本
        mainContent = mainContent.replace(/\s+/g, ' ').trim()
        
        // 限制长度
        if (mainContent.length > 5000) {
          mainContent = mainContent.slice(0, 5000)
        }
        
        return mainContent
      })
      
      console.log(`[Parse] 大众点评内容长度: ${content.length}`)
      
      // 提取页面中的店铺链接和店铺名称
      const relatedShops = await page.evaluate(() => {
        const shops: { name: string; url: string }[] = []
        
        // 查找所有链接
        const links = document.querySelectorAll('a[href]')
        links.forEach((link) => {
          const href = link.getAttribute('href') || ''
          const text = (link as HTMLElement).innerText?.trim() || ''
          
          // 只获取大众点评店铺相关的链接
          if (href.includes('dianping.com') && text && text.length > 1 && text.length < 50) {
            // 过滤掉导航链接等
            if (!href.includes('/nav') && !href.includes('/city') && !href.includes('/login')) {
              // 构造完整 URL
              let fullUrl = href
              if (href.startsWith('//')) {
                fullUrl = 'https:' + href
              } else if (href.startsWith('/')) {
                fullUrl = 'https://www.dianping.com' + href
              }
              
              shops.push({ name: text, url: fullUrl })
            }
          }
        })
        
        // 去重
        const uniqueShops = shops.filter((shop, index, self) => 
          index === self.findIndex(s => s.name === shop.name || s.url === shop.url)
        )
        
        return uniqueShops.slice(0, 10) // 最多取10个
      })
      
      console.log(`[Parse] 提取到 ${relatedShops.length} 个相关店铺`)
      
      // 如果页面内容过短，但有相关店铺信息，尝试合并
      if (content.length < 100 && relatedShops.length > 0) {
        const shopNames = relatedShops.map(s => s.name).join('、')
        content = `相关推荐店铺：${shopNames}。${content}`
        console.log(`[Parse] 合并店铺名称到内容: ${shopNames}`)
      }
      
      // 获取页面中的图片
      const imageUrls = await page.evaluate(() => {
        const images = document.querySelectorAll('img')
        const urls: string[] = []
        
        images.forEach((img) => {
          let src = img.getAttribute('data-src') || img.getAttribute('src') || ''
          // 过滤掉 logo、icon、小图
          if (src && !src.includes('logo') && !src.includes('icon') && 
              !src.includes('placeholder') && src.length > 50) {
            urls.push(src)
          }
        })
        
        return urls.slice(0, 10)
      })
      
      console.log(`[Parse] 大众点评图片数量: ${imageUrls.length}`)
      
      // 获取封面图
      const coverImage = imageUrls.length > 0 ? imageUrls[0] : ''
      
      if (!content) {
        return { success: false, message: '无法提取店铺信息' }
      }
      
      return {
        success: true,
        content,
        title,
        coverImage,
        imageUrls,
        relatedLinks: relatedShops.map(s => s.name)
      }
    } catch (error: any) {
      console.error(`[Parse] 大众点评 Playwright 获取失败:`, error.message)
      return { success: false, message: `获取店铺信息失败: ${error.message}` }
    } finally {
      if (browser) {
        await browser.close().catch(() => {})
      }
    }
  }

  // 检测来源类型
  private detectSourceType(url: string): SourceType {
    const lowerUrl = url.toLowerCase()
    
    // 一类：社交短视频/图文平台（包括小红书）
    if (
      lowerUrl.includes('douyin.com') ||
      lowerUrl.includes('v.douyin') ||
      lowerUrl.includes('xiaohongshu.com') ||
      lowerUrl.includes('xhslink.com') ||
      lowerUrl.includes('bilibili.com') ||
      lowerUrl.includes('b23.tv') ||
      lowerUrl.includes('kuaishou.com') ||
      lowerUrl.includes('ksurl.cn') ||
      lowerUrl.includes('weishi.qq.com') ||
      lowerUrl.includes('weibo.com')
    ) {
      return 'video'
    }
    
    // 二类：票务平台
    if (
      lowerUrl.includes('damai.cn') ||
      lowerUrl.includes('dmai.cn') ||
      lowerUrl.includes('piaoniu.com') ||
      lowerUrl.includes('maoyan.com') ||
      lowerUrl.includes('gewara.com') ||
      lowerUrl.includes('yongzhou.cn') ||
      lowerUrl.includes('shoukatsutravel') ||
      lowerUrl.includes('ch住') ||
      lowerUrl.includes('migu.cn') ||
      lowerUrl.includes('music.163.com') ||
      lowerUrl.includes('y.qq.com') ||
      lowerUrl.includes('ticket') ||
      lowerUrl.includes('票务') ||
      lowerUrl.includes('演唱会') ||
      lowerUrl.includes('音乐会') ||
      lowerUrl.includes('戏剧')
    ) {
      return 'ticket'
    }
    
    // 三类：商户信息平台（大众点评、美团）
    if (
      lowerUrl.includes('dianping.com') ||
      lowerUrl.includes('dpurl.cn') ||
      lowerUrl.includes('大众点评') ||
      lowerUrl.includes('meituan.com') ||
      lowerUrl.includes('美团')
    ) {
      return 'merchant'
    }
    
    // 四类：文字网页/公众号
    return 'article'
  }

  // 从文本中提取 URL
  private extractUrl(text: string): string {
    if (!text) return ''
    
    // 匹配 http/https 开头的 URL
    const urlPattern = /https?:\/\/[^\s\u4e00-\u9fa5（）！，。、;:：'""<>《》]+/gi
    const matches = text.match(urlPattern)
    
    if (matches && matches.length > 0) {
      // 返回第一个匹配的 URL，并去掉末尾的标点
      return matches[0].replace(/[，。！、；：'""<>《》]+$/, '')
    }
    
    return ''
  }

  // 从输入中提取纯文字（去掉 URL）
  private extractTextFromInput(text: string): string {
    if (!text) return ''
    
    // 去掉 URL
    const textWithoutUrl = text.replace(/https?:\/\/[^\s]+/gi, '').trim()
    
    // 去掉多余的空白字符
    return textWithoutUrl.replace(/\s+/g, ' ')
  }

  // 使用 LLM 提取关键信息
  private async extractWithLLM(
    content: string,
    sourceType: SourceType,
    title: string
  ): Promise<ParsedInspiration> {
    // 构建提示词
    const prompt = this.buildExtractPrompt(content, sourceType, title)

    console.log(`[Parse] 调用 LLM 提取信息 - sourceType: ${sourceType}, content长度: ${content.length}`)

    let response: any = null
    
    try {
      // 调用 LLM（使用默认模型）
      response = await this.llmClient.invoke(
        [{ role: 'user', content: prompt }],
        {
          temperature: 0.3
        }
      )
      
      console.log(`[Parse] LLM 响应类型: ${typeof response}`)
      console.log(`[Parse] LLM 响应 keys: ${response ? Object.keys(response) : 'null'}`)
      console.log(`[Parse] LLM 响应:`, JSON.stringify(response).slice(0, 500))
    } catch (llmError: any) {
      console.error(`[Parse] LLM 调用失败:`, llmError.message)
      return {
        name: '未命名灵感',
        location: '',
        time: '',
        primaryTag: '景点',
        secondaryTag: '',
        price: '待定',
        description: content.slice(0, 200) || 'LLM 提取失败',
        source: '',
        url: '',
        coverImage: '',
        tags: []
      }
    }

    // 解析 LLM 返回
    let responseContent = ''
    
    if (typeof response === 'string') {
      responseContent = response
    } else if (response?.content) {
      if (typeof response.content === 'string') {
        responseContent = response.content
      } else if (Array.isArray(response.content)) {
        // 处理数组格式的响应
        for (const item of response.content) {
          if (item?.type === 'text' && item?.text) {
            responseContent = item.text
            break
          }
        }
      } else if (response.content?.text) {
        responseContent = response.content.text
      }
    } else if (response?.text) {
      responseContent = response.text
    } else {
      // 尝试序列化整个响应
      try {
        responseContent = JSON.stringify(response)
      } catch {
        responseContent = String(response)
      }
    }
    
    console.log(`[Parse] LLM 响应内容长度: ${responseContent.length}`)
    console.log(`[Parse] LLM 响应内容前200字: ${responseContent.slice(0, 200)}`)

    // 解析 LLM 返回的 JSON
    const result = this.parseLLMResponse(responseContent)

    // 补充来源信息
    if (!result.source && sourceType) {
      const sourceMap = {
        video: '社交短视频平台',
        ticket: '票务平台',
        merchant: '商户信息平台',
        article: '网页/公众号',
        text: '文字输入'
      }
      result.source = sourceMap[sourceType]
    }

    return result
  }

  // 构建提取提示词（单条）
  private buildExtractPrompt(
    content: string,
    sourceType: SourceType,
    title: string
  ): string {
    const basePrompt = `你是一个专业的旅行活动信息提取助手。请从以下内容中提取关键信息，用于帮助用户规划旅行行程。

要求：
1. 提取所有与活动相关的具体信息（时间、地点、名称等）
2. 识别内容的类型（景点/美食/演出/活动/商铺）
3. 提取任何价格信息
4. 生成简洁的描述
5. 提取相关的标签（如地点、类型等）

内容：
${title ? `标题：${title}\n` : ''}
${content || '(无正文内容)'}

请以 JSON 格式返回，字段如下：
{
  "name": "活动/内容名称",
  "location": "具体地址或地点",
  "time": "时间信息（如具体日期、营业时间、游览时长等）",
  "type": "内容类型（景点/美食/演出/活动/商铺）",
  "price": "价格信息（如门票价格、人均消费等，无则填"待定"）",
  "description": "一句话简介",
  "coverImage": "封面图片URL（无则留空）",
  "tags": ["标签1", "标签2"]
}

请直接返回 JSON，不要添加任何解释。`

    return basePrompt
  }

  // 构建提取多个灵感点的提示词
  private buildMultiExtractPrompt(
    content: string,
    sourceType: SourceType,
    title: string,
    originalUrl: string
  ): string {
    return `你是一个专业的旅行活动信息提取助手。请从以下内容中仔细分析，提取出所有可能的旅行灵感点。

这是一段旅行相关的视频字幕或文章内容，需要你从中挖掘出有价值的活动灵感。

## 标签体系（两级标签）

**一级标签**（必须选择一项）：
- 景点：景区、博物馆、公园、古迹、地标、展览等
- 美食：餐厅、小吃、饮品、咖啡、甜点等
- 演出：演唱会、音乐会、戏剧、话剧、歌剧、舞剧、脱口秀、相声、魔术等舞台表演
- 活动：展览、市集、节庆活动、赛事、体验课程、工作坊、打卡活动等

**二级标签**（根据内容选择一项或多项）：
- 景点类：景区、博物馆、公园/广场、古迹遗址、地标建筑、展览展馆、游乐场、动物园/植物园、网红打卡点、文化体验
- 美食类：正餐（餐厅/酒楼）、小吃（街头美食/特色小吃）、饮品（奶茶/茶饮/果汁）、咖啡（咖啡店/茶馆）、甜点（蛋糕/冰淇淋/甜品）、烧烤/烧鸟、火锅、日料/韩料/西餐、面馆/粉店、早茶/下午茶
- 演出类：演唱会、音乐会、戏剧/话剧、歌剧/舞剧、脱口秀/喜剧、相声/曲艺、杂技/魔术、沉浸式演出
- 活动类：艺术展览、设计展览、摄影展、双年展、市集/集市、节庆活动、体育赛事、体验课程、工作坊、打卡活动

## 要求

1. 仔细阅读内容，识别出所有提到的具体活动、景点、美食店、演出等
2. 每个灵感点必须包含：一级标签、二级标签、名称、地点、时间、价格、描述
3. 标签选择要准确，不要生造标签
4. 如果提到多个地点，都要提取出来
5. 每个灵感点描述要详细，包含推荐理由和特色亮点
6. 提取相关的标签（地点、类型、特色等）
7. 票务平台（演唱会、戏剧、展览等）内容优先标记为"演出"或"活动"类型

内容：
${title ? `标题：${title}\n` : ''}
${content || '(无正文内容)'}

请以 JSON 格式返回，包含一个 inspirationPoints 数组：
{
  "totalCount": 3,
  "inspirationPoints": [
    {
      "name": "灵感点名称",
      "location": "具体地址或地点",
      "time": "推荐时间/游览时长",
      "primaryTag": "景点/美食",
      "secondaryTag": "博物馆/正餐/小吃/饮品/咖啡/等",
      "price": "人均/门票价格",
      "description": "详细描述：包含推荐理由、特色亮点等",
      "tags": ["地点", "类型", "特色标签"],
      "highlights": ["亮点1", "亮点2"]
    }
  ],
  "summary": "整体内容的简要总结"
}

请尽可能多地提取有价值的灵感点（1-10个），每个都要有详细信息。直接返回 JSON。`
  }

  // 解析 LLM 返回的 JSON
  private parseLLMResponse(content: string): ParsedInspiration {
    // 尝试提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      // 无法解析，返回默认值
      return {
        name: '未命名灵感',
        location: '',
        time: '',
        primaryTag: '景点',
        secondaryTag: '',
        price: '待定',
        description: content.slice(0, 100) || '无法提取信息',
        source: '',
        url: '',
        coverImage: '',
        tags: []
      }
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        name: parsed.name || '未命名灵感',
        location: parsed.location || '',
        time: parsed.time || '',
        primaryTag: parsed.primaryTag || parsed.type || '景点',
        secondaryTag: parsed.secondaryTag || '',
        price: parsed.price || '待定',
        description: parsed.description || '',
        source: '',
        url: '',
        coverImage: parsed.coverImage || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : []
      }
    } catch {
      return {
        name: '未命名灵感',
        location: '',
        time: '',
        primaryTag: '景点',
        secondaryTag: '',
        price: '待定',
        description: content.slice(0, 100),
        source: '',
        url: '',
        coverImage: '',
        tags: []
      }
    }
  }

  // 保存到数据库
  private async saveInspiration(input: {
    user_id: string
    title: string
    image?: string
    source?: string
    primary_tag?: string
    secondary_tag?: string
    location?: string
    time?: string
    price?: string
    description?: string
    original_url?: string
    tags?: string[]
  }) {
    const { data, error } = await this.client
      .from('inspirations')
      .insert({
        user_id: input.user_id,
        title: input.title,
        image: input.image,
        source: input.source,
        primary_tag: input.primary_tag,
        secondary_tag: input.secondary_tag,
        location_name: input.location,
        time: input.time,
        price: input.price,
        description: input.description,
        original_url: input.original_url,
        tags: input.tags,
        create_time: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw new Error(`保存失败: ${error.message}`)
    return data
  }

  // 批量解析（支持多条链接或文字）
  async batchParse(
    userId: string,
    items: Array<{ url?: string; text?: string }>
  ): Promise<Array<{ success: boolean; data?: any; message: string }>> {
    const results: Array<{ success: boolean; data?: any; message: string }> = []

    for (const item of items) {
      const result = await this.parse(userId, item)
      results.push(result)
    }

    return results
  }
}
