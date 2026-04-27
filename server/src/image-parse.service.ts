import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

@Injectable()
export class ImageParseService {
  private supabase: SupabaseClient<any, any, any>
  private llmClient: any

  onModuleInit() {
    const url = process.env.SUPABASE_URL || process.env.COZE_SUPABASE_URL
    const key = process.env.SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY
    if (url && key) {
      this.supabase = createClient(url, key)
    }
    // 初始化 LLM 客户端
    try {
      const { LLMClient } = require('coze-coding-dev-sdk')
      this.llmClient = new LLMClient()
    } catch (e) {
      console.error('[ImageParse] LLM 客户端初始化失败:', e)
    }
  }

  private getClient() {
    if (!this.supabase) {
      this.supabase = getSupabaseClient() as SupabaseClient<any, any, any>
    }
    return this.supabase
  }

  /**
   * 上传图片到 Supabase Storage
   */
  async uploadImage(file: any): Promise<{ success: boolean; url?: string; message?: string }> {
    try {
      const client = this.getClient()
      
      // 生成唯一文件名
      const ext = path.extname(file.originalname) || '.jpg'
      const fileName = `images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`
      
      // 上传到 Supabase Storage
      const { data, error } = await client.storage
        .from('travel-planner') // 存储桶名称，需要在 Supabase 中创建
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (error) {
        console.error('[ImageParse] 上传失败:', error)
        return { success: false, message: '图片上传失败' }
      }

      // 获取公开URL
      const { data: urlData } = client.storage
        .from('travel-planner')
        .getPublicUrl(data.path)

      console.log('[ImageParse] 图片上传成功:', urlData.publicUrl)
      return { success: true, url: urlData.publicUrl }
    } catch (error: any) {
      console.error('[ImageParse] 上传异常:', error)
      return { success: false, message: error.message }
    }
  }

  /**
   * 从图片URL下载并保存到临时文件
   */
  private async downloadImage(url: string): Promise<string | null> {
    try {
      const https = await import('https')
      const http = await import('http')
      const { promisify } = await import('util')
      
      const tempPath = `/tmp/image-${Date.now()}.jpg`
      
      return new Promise((resolve, reject) => {
        const get = url.startsWith('https') ? https.get : http.get
        
        get(url, (res: any) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            // 处理重定向
            get(res.headers.location, (res2: any) => {
              const chunks: Buffer[] = []
              res2.on('data', (chunk: Buffer) => chunks.push(chunk))
              res2.on('end', () => {
                fs.writeFileSync(tempPath, Buffer.concat(chunks))
                resolve(tempPath)
              })
              res2.on('error', reject)
            }).on('error', reject)
          } else {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => {
              fs.writeFileSync(tempPath, Buffer.concat(chunks))
              resolve(tempPath)
            })
            res.on('error', reject)
          }
        }).on('error', reject)
      })
    } catch (error) {
      console.error('[ImageParse] 下载图片失败:', error)
      return null
    }
  }

  /**
   * 使用 LLM 视觉能力识别图片并提取灵感点
   */
  async parseImageFromUrl(imageUrl: string): Promise<{
    success: boolean
    data?: {
      extractedText?: string
      inspirationPoints: Array<{
        id?: string
        name: string
        location?: string
        time?: string
        price?: string
        description?: string
        primaryTag?: string
        secondaryTag?: string
        tags?: string[]
        sourceUrl?: string
        selected?: boolean
      }>
    }
    message?: string
  }> {
    try {
      console.log('[ImageParse] 开始识别图片:', imageUrl)
      
      // 构造提示词，要求从图片中提取旅行灵感点
      const prompt = `请仔细分析这张图片，识别其中的旅行灵感点信息。

图片可能包含：
- 景点打卡照片和名称
- 餐厅/美食店名和地址
- 活动/演出信息
- 购物地点推荐
- 手写或打印的旅行清单
- 社交媒体截图

请提取所有可以转化为"灵感点"的信息，格式如下（返回JSON数组）：
[
  {
    "name": "地点/店铺/活动名称",
    "location": "详细地址或位置描述",
    "time": "推荐时间或营业时间（如果有）",
    "price": "人均消费或门票价格（如果有）",
    "description": "简短描述或特色介绍",
    "primaryTag": "分类：景点/美食/演出/活动/购物",
    "secondaryTag": "二级标签（如：上海/网红打卡/亲子等）",
    "tags": ["标签1", "标签2"]
  }
]

如果图片中没有明显的旅行灵感点信息，请返回一个空数组 []。

只返回JSON数组，不要有其他文字。`

      // 使用视觉模型分析图片
      let response: any = null
      try {
        if (this.llmClient) {
          // 构建消息内容（正确的格式）
          const messageContent = [
            { 
              role: 'user', 
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ]
          
          console.log('[ImageParse] 调用 LLM，图片URL:', imageUrl)
          response = await this.llmClient.invoke(messageContent)
          
          console.log('[ImageParse] LLM 响应类型:', typeof response)
          console.log('[ImageParse] LLM 响应 keys:', response ? Object.keys(response) : 'null')
          console.log('[ImageParse] LLM 响应:', JSON.stringify(response).slice(0, 500))
        } else {
          console.error('[ImageParse] LLM 客户端未初始化')
          return {
            success: false,
            message: 'LLM 服务未初始化',
            data: {
              inspirationPoints: []
            }
          }
        }
      } catch (llmError: any) {
        console.error('[ImageParse] LLM 调用失败:', llmError.message)
        return {
          success: false,
          message: '图片识别服务暂不可用: ' + llmError.message,
          data: {
            inspirationPoints: []
          }
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
      
      console.log('[ImageParse] 解析后内容:', responseContent.slice(0, 300))

      // 解析 LLM 返回的 JSON
      let inspirationPoints: any[] = []
      
      if (responseContent) {
        try {
          // 尝试解析 JSON
          // 移除可能的 markdown 代码块标记
          const jsonStr = responseContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
          inspirationPoints = JSON.parse(jsonStr)
          
          // 为每个灵感点生成唯一 ID
          inspirationPoints = inspirationPoints.map((p, index) => ({
            ...p,
            id: `img_${Date.now()}_${index}`,
            selected: true
          }))
        } catch (parseError) {
          console.error('[ImageParse] 解析 LLM 返回失败:', parseError)
          console.log('[ImageParse] LLM 原始返回:', responseContent)
        }
      }

      if (inspirationPoints.length === 0) {
        return {
          success: true,
          data: {
            extractedText: '',
            inspirationPoints: []
          },
          message: '未能从图片中识别到明确的灵感点'
        }
      }

      console.log('[ImageParse] 成功识别:', inspirationPoints.length, '个灵感点')
      
      return {
        success: true,
        data: {
          inspirationPoints
        }
      }
    } catch (error: any) {
      console.error('[ImageParse] 识别失败:', error)
      return {
        success: false,
        message: '图片识别失败: ' + error.message,
        data: {
          inspirationPoints: []
        }
      }
    }
  }
}
