import { Controller, Post, Body, Get, Query } from '@nestjs/common'
import { ParseService } from '@/parse.service'
import { TripService } from '@/trip.service'
import { UserService } from '@/user.service'

@Controller('message')
export class MessageController {
  constructor(
    private readonly parseService: ParseService,
    private readonly tripService: TripService,
    private readonly userService: UserService
  ) {}

  /**
   * 处理公众号用户发送的消息（链接）
   * 微信消息会携带 FromUserName（用户OpenID）和 ToUserName（公众号ID）
   */
  @Post('process')
  async processMessage(@Body() body: {
    openid: string  // 微信用户的 openid
    content: string // 消息内容（可能是链接）
  }) {
    console.log(`[Message] 收到消息 from openid=${body.openid}: ${body.content}`)
    
    const { openid, content } = body

    // 1. 确保用户已注册
    let user = await this.userService.getUserByOpenid(openid)
    if (!user) {
      // 自动创建用户
      user = await this.userService.getOrCreateUser(openid)
    }

    // 2. 检查是否是URL
    const url = this.extractUrl(content)
    if (url) {
      // 解析链接
      const result = await this.parseService.parseShareUrl(url, user.id)
      
      return {
        code: 200,
        data: {
          success: true,
          message: `已收录 "${result.title}" 到您的灵感库`,
          inspiration: {
            title: result.title,
            type: result.type,
            source: result.source
          }
        }
      }
    }

    // 3. 非URL消息，返回帮助
    return {
      code: 200,
      data: {
        success: true,
        message: '请发送旅行相关的分享链接，我会帮您收录到灵感库',
        tips: [
          '支持：小红书、大众点评、大麦、携程等平台的链接',
          '收录后可在小程序中查看并规划路线'
        ]
      }
    }
  }

  /**
   * 获取用户灵感列表（供小程序调用）
   */
  @Get('inspirations')
  async getUserInspirations(@Query('userId') userId: string) {
    const data = await this.tripService.getInspirations(userId)
    return { code: 200, data }
  }

  /**
   * 批量处理链接
   */
  @Post('batch')
  async batchProcess(@Body() body: {
    userId: string
    urls: string[]
  }) {
    const results = await this.parseService.batchParse(body.urls, body.userId)
    
    return {
      code: 200,
      data: {
        results,
        summary: `成功收录 ${results.filter((r: any) => r.success).length} 个灵感`
      }
    }
  }

  /**
   * 获取用户信息（供小程序调用）
   */
  @Get('user')
  async getUserInfo(@Query('openid') openid: string) {
    let user = await this.userService.getUserByOpenid(openid)
    
    if (!user) {
      // 创建新用户
      user = await this.userService.getOrCreateUser(openid)
    }

    const inspirationCount = await this.userService.getUserInspirationCount(user.id)

    return {
      code: 200,
      data: {
        id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatar: user.avatar,
        inspiration_count: inspirationCount
      }
    }
  }

  /**
   * 更新用户信息（供小程序调用）
   */
  @Post('user')
  async updateUserInfo(@Body() body: {
    openid: string
    nickname?: string
    avatar?: string
  }) {
    const user = await this.userService.updateUser(body.openid, {
      nickname: body.nickname,
      avatar: body.avatar
    })

    return {
      code: 200,
      data: { success: true, user }
    }
  }

  /**
   * 提取URL
   */
  private extractUrl(content: string): string | null {
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
    const matches = content.match(urlPattern)
    return matches ? matches[0] : null
  }
}
