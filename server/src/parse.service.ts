import { Injectable } from '@nestjs/common'
import { FetchClient, LLMClient, Config } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { AsrService } from './asr.service'
import { AudioService } from './audio.service'
import { VideoParseService } from './video-parse.service'
import { execSync } from 'child_process'

// 类型映射：中文 -> 英文
const typeMap: Record<string, string> = {
  '景点': 'spot',
  'spot': 'spot',
  '旅游': 'spot',
  '游览': 'spot',
  '美食': 'food',
  'food': 'food',
  '餐饮': 'food',
  '吃': 'food',
  '餐厅': 'food',
  '演出': 'show',
  'show': 'show',
  '表演': 'show',
  '演唱会': 'show',
  '活动': 'show',
  '酒店': 'hotel',
  'hotel': 'hotel',
  '住宿': 'hotel',
  '民宿': 'hotel',
  '客栈': 'hotel',
  '视频': 'spot',  // 默认视频类型为景点
  '默认': 'spot',
}

function normalizeType(type: string): string {
  if (!type) return 'spot'
  return typeMap[type] || 'spot'
}

// 解析后的灵感数据
export interface ParsedInspiration {
  name: string
  location: string
  time: string
  type: string
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
        type: normalizeType(parsed.type),  // 转换类型为英文
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

  // 使用 fetch-url 获取页面内容
  private async fetchUrl(url: string): Promise<{
    success: boolean
    content?: string
    title?: string
    coverImage?: string
    message?: string
  }> {
    try {
      console.log(`[Parse] Fetch URL: ${url}`)
      
      const response = await this.fetchClient.fetch(url)

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

      return {
        success: true,
        content: textContent,
        title: response.title || '',
        coverImage
      }
    } catch (error: any) {
      console.error(`[Parse] Fetch 失败:`, error)
      return { success: false, message: `获取页面失败: ${error.message}` }
    }
  }

  // 检测来源类型
  private detectSourceType(url: string): SourceType {
    const lowerUrl = url.toLowerCase()
    
    // 一类：社交短视频平台
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
      lowerUrl.includes('摩天轮') ||
      lowerUrl.includes('票牛') ||
      lowerUrl.includes('大麦')
    ) {
      return 'ticket'
    }
    
    // 三类：商户信息平台
    if (
      lowerUrl.includes('dianping.com') ||
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

    console.log(`[Parse] 调用 LLM 提取信息 - sourceType: ${sourceType}`)

    // 调用 LLM
    const response = await this.llmClient.invoke(
      [{ role: 'user', content: prompt }],
      {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.3
      }
    )

    // 解析 LLM 返回的 JSON
    const result = this.parseLLMResponse(response.content)

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

  // 构建提取提示词
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
        type: '活动',
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
        type: parsed.type || '活动',
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
        type: '活动',
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
    type?: string
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
        type: input.type,
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
