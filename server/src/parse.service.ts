import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 类型定义
interface InspirationInput {
  user_id: string
  title: string
  image?: string
  source: string
  type: 'spot' | 'food' | 'show' | 'hotel'
  location?: { name: string; lat: number; lng: number }
  time?: string
  price?: number
  original_url?: string
  description?: string
}

interface ParsedContent {
  title: string
  image?: string
  description?: string
  type: 'spot' | 'food' | 'show' | 'hotel'
  location?: { name: string; lat: number; lng: number }
}

@Injectable()
export class ParseService {
  private get client() {
    return getSupabaseClient()
  }

  // 解析分享链接
  async parseShareUrl(url: string, userId: string): Promise<any> {
    try {
      console.log(`[Parse] 正在解析链接: ${url}`)
      
      // 使用原生 fetch 抓取内容
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        }
      })
      
      const html = await response.text()
      
      // 解析内容
      const parsed = this.extractFromHtml(html, url)
      
      // 保存到数据库
      const inspiration = await this.saveInspiration({
        user_id: userId,
        title: parsed.title,
        image: parsed.image,
        source: this.detectSource(url),
        type: parsed.type,
        location: parsed.location,
        original_url: url,
        description: parsed.description
      })
      
      return {
        success: true,
        data: inspiration,
        message: `已收录「${parsed.title}」到灵感池`
      }
    } catch (error: any) {
      console.error(`[Parse] 解析失败:`, error)
      return {
        success: false,
        message: `解析失败: ${error.message}`
      }
    }
  }

  // 从HTML中提取内容
  private extractFromHtml(html: string, url: string): ParsedContent {
    // 提取标题
    let title = '未命名灵感'
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      title = titleMatch[1].trim()
    }
    
    // 提取描述
    let description: string | undefined
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)
    if (descMatch) {
      description = descMatch[1].slice(0, 200)
    }
    
    // 提取图片（取第一张）
    let image: string | undefined
    const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
    if (imgMatch) {
      image = imgMatch[1]
    }
    
    // 根据URL和内容自动识别类型
    const type = this.detectType(url, title, description)
    
    // 尝试提取位置信息
    const location = this.extractLocation(title, description)
    
    return { title, image, description, type, location }
  }

  // 检测来源平台
  private detectSource(url: string): string {
    const lowerUrl = url.toLowerCase()
    if (lowerUrl.includes('xiaohongshu') || lowerUrl.includes('xhs')) {
      return 'xiaohongshu'
    }
    if (lowerUrl.includes('dianping') || lowerUrl.includes('大众点评')) {
      return 'dazhong'
    }
    if (lowerUrl.includes('damai') || lowerUrl.includes('大麦')) {
      return 'damai'
    }
    if (lowerUrl.includes('meituan')) {
      return 'meituan'
    }
    if (lowerUrl.includes('ctrip') || lowerUrl.includes('携程')) {
      return 'ctrip'
    }
    if (lowerUrl.includes('qunar') || lowerUrl.includes('去哪儿')) {
      return 'qunar'
    }
    return 'other'
  }

  // 自动识别内容类型
  private detectType(url: string, title: string, description?: string): 'spot' | 'food' | 'show' | 'hotel' {
    const text = `${url} ${title} ${description || ''}`.toLowerCase()
    
    // 关键词匹配
    const keywords = {
      hotel: ['酒店', '民宿', '客栈', '住宿', 'hotel', 'homestay', 'airbnb'],
      food: ['美食', '餐厅', '小吃', '火锅', '烧烤', 'cafe', 'restaurant', 'food', '必吃', '推荐'],
      show: ['演唱会', '话剧', '音乐剧', '展览', '电影', '演出', 'show', 'concert', 'ticket'],
      spot: ['景点', '打卡', '攻略', '旅行', '攻略', '景点', '公园', '博物馆', 'spot', 'tourist']
    }
    
    // 计算每种类型的匹配度
    let maxScore = 0
    let detectedType: 'spot' | 'food' | 'show' | 'hotel' = 'spot'
    
    for (const [type, words] of Object.entries(keywords)) {
      const score = words.filter(w => text.includes(w)).length
      if (score > maxScore) {
        maxScore = score
        detectedType = type as any
      }
    }
    
    return detectedType
  }

  // 尝试提取位置信息（简单实现）
  private extractLocation(title: string, description?: string): { name: string; lat: number; lng: number } | undefined {
    const text = `${title} ${description || ''}`
    
    // 简单的位置提取（实际项目中可以使用地理编码API）
    // 这里返回空，后续可以让用户手动补充
    return undefined
  }

  // 保存灵感到数据库
  private async saveInspiration(input: InspirationInput) {
    const { data, error } = await this.client
      .from('inspirations')
      .insert(input)
      .select()
      .single()
    
    if (error) throw new Error(`保存失败: ${error.message}`)
    return data
  }

  // 批量解析（支持多条链接）
  async batchParse(urls: string[], userId: string): Promise<any[]> {
    const results: any[] = []
    for (const url of urls) {
      try {
        const result = await this.parseShareUrl(url, userId)
        results.push({ success: true, ...result })
      } catch (error: any) {
        results.push({ success: false, error: error.message })
      }
    }
    return results
  }
}
