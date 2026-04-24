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
   * 处理用户发送的消息（链接）
   * 支持两种模式：
   * 1. 直接发送链接（通过 userId 或 userCode 关联用户）
   * 2. 先发送"绑定#用户码"来关联账号
   */
  @Post('process')
  async processMessage(@Body() body: {
    openid?: string  // 微信 openid（优先使用）
    userCode?: string // 用户码（备选）
    userId?: string   // 用户ID（备选）
    content: string   // 消息内容
  }) {
    console.log(`[Message] 收到消息: openid=${body.openid}, userCode=${body.userCode}`)
    
    // 1. 尝试获取用户
    let user: any = null
    if (body.openid) {
      user = await this.userService.getUserByOpenid(body.openid)
    } else if (body.userCode) {
      user = await this.userService.getUserByCode(body.userCode)
    } else if (body.userId) {
      // 兼容旧逻辑
      user = { id: body.userId }
    }

    // 2. 检查是否是绑定命令
    if (body.content.startsWith('绑定#') || body.content.startsWith('绑定')) {
      const code = body.content.replace('绑定#', '').replace('绑定', '').trim()
      if (code && body.openid) {
        // 将当前微信账号绑定到已有用户
        return await this.bindUserCode(body.openid, code)
      }
      return {
        code: 400,
        msg: '缺少用户码或openid',
        data: { message: '请先在小程序中获取您的用户码' }
      }
    }

    // 3. 检查是否是URL
    const url = this.extractUrl(body.content)
    if (url) {
      if (!user) {
        // 没有关联用户，返回引导信息
        return {
          code: 200,
          data: {
            success: false,
            needBind: true,
            message: '请先绑定小程序账号',
            hint: '打开小程序获取用户码，然后发送：绑定#用户码'
          }
        }
      }
      
      // 解析链接
      const result = await this.parseService.parseShareUrl(url, user.id)
      return {
        code: 200,
        data: result
      }
    }

    // 4. 非URL消息，返回帮助
    return {
      code: 200,
      data: {
        success: false,
        message: '请发送分享链接，系统将自动解析收录',
        commands: [
          '发送链接 - 自动收录到灵感池',
          '绑定#用户码 - 关联小程序账号'
        ]
      }
    }
  }

  /**
   * 绑定用户码
   */
  private async bindUserCode(openid: string, userCode: string) {
    const targetUser = await this.userService.getUserByCode(userCode)
    
    if (!targetUser) {
      return {
        code: 200,
        data: {
          success: false,
          message: `用户码 ${userCode} 不存在，请确认后重新输入`
        }
      }
    }

    // 更新用户的 openid
    const { data, error } = await this.getSupabaseClient()
      .from('users')
      .update({ openid })
      .eq('id', targetUser.id)
      .select()
      .single()

    if (error) {
      return {
        code: 500,
        data: { success: false, message: '绑定失败，请重试' }
      }
    }

    return {
      code: 200,
      data: {
        success: true,
        message: `绑定成功！您的账号已关联到此微信`,
        user: {
          nickname: targetUser.nickname || '用户',
          inspirationCount: await this.userService.getUserInspirationCount(targetUser.id)
        }
      }
    }
  }

  /**
   * 获取微信小程序的 openid（需要通过 wx.login 获取 code 后调用）
   * 此接口用于：前端获取 code，后端通过 code 换取 openid
   */
  @Post('login')
  async wechatLogin(@Body() body: { code: string }) {
    try {
      // 实际项目中需要调用微信 API 获取 openid
      // const openid = await this.getOpenidFromCode(body.code)
      
      // 这里简化处理，假设前端直接传了 openid
      return {
        code: 200,
        data: {
          success: true,
          openid: body.code // 实际应该是微信返回的 openid
        }
      }
    } catch (error) {
      return {
        code: 500,
        data: { success: false, message: '登录失败' }
      }
    }
  }

  private getSupabaseClient() {
    return this.userService.getSupabaseClient()
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
   * 获取用户灵感列表
   */
  @Get('inspirations')
  async getUserInspirations(@Query('userId') userId: string) {
    const data = await this.tripService.getInspirations(userId)
    return { code: 200, data }
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
