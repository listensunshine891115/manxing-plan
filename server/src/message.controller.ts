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
   */
  @Post('receive')
  async receiveMessage(@Body() body: {
    ToUserName?: string
    FromUserName?: string  // 公众号用户 OpenID
    MsgType?: string
    Content?: string
    Url?: string
    Title?: string
    Description?: string
  }) {
    console.log('[WeChat] 收到消息:', JSON.stringify(body))

    const wxOpenid = body.FromUserName
    const content = body.Content || body.Url || ''

    if (!wxOpenid) {
      return this.replyText('', '消息格式错误')
    }

    // 处理不同消息类型
    const msgType = body.MsgType || 'text'

    // 1. 检查是否是绑定命令
    if (content.startsWith('绑定#') || content.startsWith('绑定')) {
      return await this.handleBindCommand(wxOpenid, content)
    }

    // 2. 检查是否已绑定
    const user = await this.userService.getUserByWxOpenid(wxOpenid)
    
    if (!user) {
      // 未绑定，返回引导消息
      return this.replyText(wxOpenid, `您还未绑定小程序账号

请先打开小程序获取您的用户码，然后发送：
绑定#用户码

例如：绑定#ABC123`)
    }

    // 3. 处理链接
    const url = body.Url || this.extractUrl(content)
    if (url) {
      return await this.handleLinkMessage(user.id, url, body.Title, body.Description, wxOpenid)
    }

    // 4. 非链接消息，返回欢迎信息
    return this.replyText(wxOpenid, `欢迎回来！🎉

已绑定账号：${user.nickname}

请发送旅行相关的分享链接，我会自动帮您收录到灵感库。`)

  }

  /**
   * 处理绑定命令
   */
  private async handleBindCommand(wxOpenid: string, content: string) {
    // 提取用户码
    const match = content.match(/绑定#?([A-Z0-9]{6,8})/i)
    if (!match) {
      return this.replyText(wxOpenid, `绑定格式错误

请发送：绑定#您的用户码
例如：绑定#ABC123

您可以在小程序中查看您的用户码。`)
    }

    const userCode = match[1].toUpperCase()
    
    // 查找对应的用户
    const user = await this.userService.getUserByCode(userCode)
    if (!user) {
      return this.replyText(wxOpenid, `用户码 ${userCode} 不存在

请确认您的小程序用户码是否正确，或重新打开小程序获取新的用户码。`)
    }

    // 检查是否已被其他账号绑定
    if (user.wx_openid && user.wx_openid !== wxOpenid) {
      return this.replyText(wxOpenid, `该用户码已被其他账号绑定

每个用户码只能绑定一个公众号账号。如需重新绑定，请联系客服。`)
    }

    // 执行绑定
    try {
      await this.userService.bindWechatOpenid(user.id, wxOpenid)
      
      return this.replyText(wxOpenid, `绑定成功！🎉

账号：${user.nickname}
用户码：${user.user_code}

现在您可以发送旅行链接，我会自动收录到您的灵感库。`)
    } catch (error) {
      console.error('绑定失败:', error)
      return this.replyText(wxOpenid, `绑定失败，请稍后重试`)
    }
  }

  /**
   * 处理链接消息
   */
  private async handleLinkMessage(userId: string, url: string, title?: string, desc?: string, wxOpenid?: string) {
    try {
      console.log('[WeChat] 解析链接:', url)
      
      const result = await this.parseService.parse(userId, { url })
      
      const typeEmoji: Record<string, string> = {
        '景点': '🏛️',
        '美食': '🍜',
        '演出': '🎭',
        '活动': '🎪',
        '商铺': '🏪'
      }
      const emoji = typeEmoji[result.data?.type] || '📍'

      return this.replyText(wxOpenid || '', `${emoji} 已收录！

${result.data?.name || title || '未知标题'}

类型：${result.data?.type || '活动'}
来源：${result.data?.source || '链接'}

请打开小程序查看您的灵感库～`)

    } catch (error) {
      console.error('[WeChat] 解析失败:', error)
      return this.replyText(wxOpenid || '', `收录失败，请检查链接是否有效

支持的平台：
• 小红书
• 大众点评
• 大麦
• 携程
• 马蜂窝`)
    }
  }

  /**
   * 回复文本消息
   */
  private replyText(wxOpenid: string, content: string): { xml: any } {
    return {
      xml: {
        ToUserName: wxOpenid,
        FromUserName: 'gh_xxxxxxx', // 需配置为公众号ID
        CreateTime: Math.floor(Date.now() / 1000),
        MsgType: 'text',
        Content: content
      }
    }
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
        user_code: user.user_code,
        wx_openid: user.wx_openid,
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
