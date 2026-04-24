import { Controller, Post, Body, Get, Query } from '@nestjs/common'
import { ParseService } from '@/parse.service'
import { TripService } from '@/trip.service'

@Controller('message')
export class MessageController {
  constructor(
    private readonly parseService: ParseService,
    private readonly tripService: TripService
  ) {}

  /**
   * 处理用户发送的消息（链接）
   * 实际项目中这里会对接微信消息接口
   * 目前作为内部接口，供测试和演示使用
   */
  @Post('process')
  async processMessage(@Body() body: {
    userId: string
    content: string
  }) {
    console.log(`[Message] 收到用户消息: ${body.userId} - ${body.content}`)
    
    // 检查是否是URL
    const url = this.extractUrl(body.content)
    
    if (url) {
      // 解析链接
      const result = await this.parseService.parseShareUrl(url, body.userId)
      return {
        code: 200,
        msg: 'success',
        data: result
      }
    }
    
    // 非URL消息，返回帮助信息
    return {
      code: 200,
      msg: 'success',
      data: {
        success: false,
        message: '请发送分享链接，系统将自动解析内容',
        help: '将小红书、大众点评等平台的分享链接发送给我，我会自动收录到你的灵感池'
      }
    }
  }

  /**
   * 批量处理链接（支持一次发送多条）
   */
  @Post('batch')
  async batchProcess(@Body() body: {
    userId: string
    urls: string[]
  }) {
    console.log(`[Message] 批量处理 ${body.urls.length} 个链接`)
    
    const results = await this.parseService.batchParse(body.urls, body.userId)
    
    return {
      code: 200,
      msg: 'success',
      data: {
        results,
        summary: `成功收录 ${results.filter((r: any) => r.success).length} 个灵感`
      }
    }
  }

  /**
   * 获取用户灵感列表（供小程序端调用）
   */
  @Get('inspirations')
  async getUserInspirations(@Query('userId') userId: string) {
    const data = await this.tripService.getInspirations(userId)
    return {
      code: 200,
      msg: 'success',
      data
    }
  }

  /**
   * 检查消息是否包含链接
   */
  private extractUrl(content: string): string | null {
    // URL正则表达式
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
    const matches = content.match(urlPattern)
    
    if (matches && matches.length > 0) {
      // 返回第一个URL
      return matches[0]
    }
    
    return null
  }
}
