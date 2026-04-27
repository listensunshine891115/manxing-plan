/**
 * 图片解析服务
 * 使用 LLM 视觉能力识别图片中的灵感点
 */

import { Injectable } from '@nestjs/common'
import * as path from 'path'
import * as fs from 'fs'

// 动态导入 SDK
let LLMClient: any = null
let Config: any = null

@Injectable()
export class ImageParseService {
  private llmClient: any = null
  private supabase: any = null
  private tempFiles: Set<string> = new Set()

  constructor() {
    this.initLLMClient()
  }

  private async initLLMClient() {
    try {
      const sdk = require('coze-coding-dev-sdk')
      Config = sdk.Config
      LLMClient = sdk.LLMClient
      this.llmClient = new LLMClient()
      console.log('[ImageParse] LLM 客户端初始化成功')
    } catch (error: any) {
      console.error('[ImageParse] LLM 客户端初始化失败:', error.message)
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
  async uploadImage(file: any): Promise<{ success: boolean; url?: string; localPath?: string; message?: string }> {
    try {
      const client = this.getClient()
      
      // 生成唯一文件名
      const ext = path.extname(file.originalname) || '.jpg'
      const fileName = `images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`
      
      // 如果有 buffer，直接保存到本地（用于后续处理）
      let localPath: string | null = null
      if (file.buffer) {
        localPath = `/tmp/${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`
        fs.writeFileSync(localPath, file.buffer)
        this.tempFiles.add(localPath)
      }
      
      // 上传到 Supabase Storage
      let publicUrl = ''
      try {
        const { data, error } = await client.storage
          .from('travel-planner')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          })

        if (error) {
          console.error('[ImageParse] 上传到 Supabase 失败:', error)
        } else {
          const { data: urlData } = client.storage
            .from('travel-planner')
            .getPublicUrl(data.path)
          publicUrl = urlData.publicUrl
        }
      } catch (storageError: any) {
        console.error('[ImageParse] Storage 上传异常:', storageError.message)
      }

      console.log('[ImageParse] 图片处理成功:', { publicUrl, localPath })
      return { 
        success: true, 
        url: publicUrl,
        localPath: localPath || undefined 
      }
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
      
      const tempPath = `/tmp/image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`
      
      return new Promise((resolve, reject) => {
        const get = url.startsWith('https') ? https.get : http.get
        
        get(url, (res: any) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            get(res.headers.location, (res2: any) => {
              const chunks: Buffer[] = []
              res2.on('data', (chunk: Buffer) => chunks.push(chunk))
              res2.on('end', () => {
                fs.writeFileSync(tempPath, Buffer.concat(chunks))
                this.tempFiles.add(tempPath)
                resolve(tempPath)
              })
              res2.on('error', reject)
            }).on('error', reject)
          } else {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => {
              fs.writeFileSync(tempPath, Buffer.concat(chunks))
              this.tempFiles.add(tempPath)
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
   * 解析图片中的灵感点
   */
  async parseImage(userId: string, imageUrl: string): Promise<any> {
    console.log('[ImageParse] 开始解析图片:', imageUrl)

    let imagePath: string | null = null

    // 判断是本地文件路径还是 URL
    if (imageUrl.startsWith('/tmp/') || imageUrl.startsWith('/uploads/')) {
      // 本地文件路径，直接使用
      if (fs.existsSync(imageUrl)) {
        imagePath = imageUrl
        console.log('[ImageParse] 使用本地文件:', imagePath)
      }
    } else if (imageUrl.startsWith('data:')) {
      // Base64 图片
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        const buffer = Buffer.from(match[2], 'base64')
        imagePath = `/tmp/image-${Date.now()}.jpg`
        fs.writeFileSync(imagePath, buffer)
        this.tempFiles.add(imagePath)
        console.log('[ImageParse] 从 Base64 保存到:', imagePath)
      }
    }

    // 如果不是本地文件，尝试下载
    if (!imagePath) {
      console.log('[ImageParse] 尝试下载图片:', imageUrl)
      imagePath = await this.downloadImage(imageUrl)
    }

    // 检查文件是否存在
    if (!imagePath || !fs.existsSync(imagePath)) {
      console.error('[ImageParse] 图片文件不存在')
      return {
        success: false,
        message: '图片文件不存在',
        data: {
          inspirationPoints: []
        }
      }
    }

    const prompt = `请分析这张图片，提取其中与旅行、景点、美食相关的灵感点。

请以 JSON 数组格式返回，每个元素包含以下字段：
- name: 地点/景点名称
- location: 位置/地址
- time: 推荐时间/季节
- primaryTag: 主要标签（如：景点、美食、住宿、购物、娱乐）
- secondaryTag: 次要标签（如：网红打卡、历史遗迹、自然风光等）
- price: 预算/价格
- description: 简短描述（30字内）
- tags: 相关标签数组

示例格式：
[{"name":"外滩","location":"上海市黄浦区","time":"傍晚","primaryTag":"景点","secondaryTag":"夜景","price":"免费","description":"欣赏上海夜景的绝佳地点","tags":["夜景","拍照","浪漫"]}]

请返回 JSON 数组，如果没有找到旅行相关灵感，返回空数组 []。`

    try {
      // 使用视觉模型分析图片
      let response: any = null
      
      // 读取图片文件并转为 base64
      const imageBuffer = fs.readFileSync(imagePath)
      const base64Image = imageBuffer.toString('base64')
      const mimeType = this.getMimeType(imagePath)
      const dataUri = `data:${mimeType};base64,${base64Image}`

      console.log('[ImageParse] 图片大小:', imageBuffer.length, '字节')
      
      if (this.llmClient) {
        // 构建消息内容（正确的格式）
        const messageContent = [
          { 
            role: 'user', 
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUri } }
            ]
          }
        ]
        
        console.log('[ImageParse] 调用 LLM 分析图片')
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

      return {
        success: true,
        message: '识别成功',
        data: {
          inspirationPoints,
          extractedText: ''
        }
      }
    } catch (error: any) {
      console.error('[ImageParse] 解析失败:', error)
      return {
        success: false,
        message: error.message || '图片识别服务暂不可用',
        data: {
          inspirationPoints: []
        }
      }
    } finally {
      // 清理临时文件（如果是上传产生的临时文件）
      if (imagePath && this.tempFiles.has(imagePath)) {
        try {
          fs.unlinkSync(imagePath)
          this.tempFiles.delete(imagePath)
        } catch {}
      }
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    }
    return mimeTypes[ext] || 'image/jpeg'
  }
}

// 导入 Supabase 客户端
import { getSupabaseClient } from './storage/database/supabase-client'
import { SupabaseClient } from '@supabase/supabase-js'
