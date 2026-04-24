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
   * 处理微信公众号用户发送的消息
   * 
   * 微信服务器会发送 XML 格式的消息：
   * <xml>
   *   <ToUserName><![CDATA[公众号ID]]></ToUserName>
   *   <FromUserName><![CDATA[用户OpenID]]></FromUserName>
   *   <MsgType><![CDATA[text]]></MsgType>
   *   <Content><![CDATA[用户发送的内容]]></Content>
   *   <CreateTime>1234567890</CreateTime>
   * </xml>
   */
  @Post('receive')
  async receiveMessage(@Body() body: {
    ToUserName?: string   // 公众号ID
    FromUserName?: string // 用户OpenID（关键！）
    MsgType?: string      // 消息类型：text/image/link等
    Content?: string       // 文本内容
    Url?: string           // 链接内容（分享链接时）
    Title?: string         // 链接标题
    Description?: string   // 链接描述
    CreateTime?: number    // 创建时间
  }) {
    console.log('[WeChat] 收到消息:', JSON.stringify(body))

    const openid = body.FromUserName || body.openid
    const content = body.Content || body.Url || ''

    // 1. 验证 openid
    if (!openid) {
      return this.replyText('', '消息格式错误')
    }

    // 2. 确保用户已注册
    let user = await this.userService.getUserByOpenid(openid)
    if (!user) {
      user = await this.userService.getOrCreateUser(openid)
      console.log('[WeChat] 新用户注册:', openid)
    }

    // 3. 处理不同消息类型
    const msgType = body.MsgType || 'text'

    if (msgType === 'link' || this.isUrl(content)) {
      // 链接消息 - 解析并收录
      const url = body.Url || this.extractUrl(content)
      if (url) {
        return await this.handleLinkMessage(user.id, url, body.Title, body.Description, openid)
      }
    }

    if (this.isUrl(content)) {
      // 文本消息中的链接 - 解析并收录
      const url = this.extractUrl(content)
      if (url) {
        return await this.handleLinkMessage(user.id, url, '', '', openid)
      }
    }

    // 4. 非链接消息 - 返回欢迎/帮助信息
    return this.replyText(openid, `欢迎使用旅行灵感库！🎉

请发送您收藏的旅行链接，我会自动帮您解析并收录到灵感库。

支持：小红书、大众点评、大麦、携程、马蜂窝等平台的分享链接。

收录后打开小程序即可查看并规划路线。`)

  }

  /**
   * 处理链接消息
   */
  private async handleLinkMessage(userId: string, url: string, title?: string, desc?: string, openid?: string) {
    try {
      console.log('[WeChat] 解析链接:', url)
      
      const result = await this.parseService.parseShareUrl(url, userId)
      
      const typeEmoji = {
        spot: '🏛️',
        food: '🍜',
        show: '🎭',
        hotel: '🏨'
      }[result.type] || '📍'

      return this.replyText(openid, `${typeEmoji} 已收录！

${result.title || title || '未知标题'}

类型：${result.typeName || result.type}
来源：${result.sourceName || result.source}

请打开小程序查看您的灵感库～`)

    } catch (error) {
      console.error('[WeChat] 解析失败:', error)
      return this.replyText(openid, `收录失败，请检查链接是否有效

支持的平台：
• 小红书
• 大众点评
• 大麦
• 携程
• 马蜂窝`)
    }
  }

  /**
   * 回复文本消息（微信 XML 格式）
   */
  private replyText(openid: string, content: string): { xml: any } {
    if (!openid) {
      return { xml: { Content: '系统繁忙，请稍后重试' } }
    }

    return {
      xml: {
        ToUserName: openid,
        FromUserName: 'gh_xxxxxxx', // 实际应配置为公众号ID
        CreateTime: Math.floor(Date.now() / 1000),
        MsgType: 'text',
        Content: content
      }
    }
  }

  /**
   * 判断是否URL
   */
  private isUrl(content: string): boolean {
    return /https?:\/\//.test(content)
  }

  /**
   * 提取URL
   */
  private extractUrl(content: string): string | null {
    const matches = content.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/)
    return matches ? matches[0] : null
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
   * 获取用户信息（供小程序调用）
   */
  @Get('user')
  async getUserInfo(@Query('openid') openid: string) {
    let user = await this.userService.getUserByOpenid(openid)
    
    if (!user) {
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
}
