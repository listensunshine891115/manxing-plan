import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common'
import { NotificationService } from '@/notification.service'

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 保存订阅状态
   * POST /api/notification/subscribe
   */
  @Post('subscribe')
  async subscribe(@Body() body: {
    openid: string
    sessionId: string
    templateType: 'vote_result' | 'vote_reminder'
    subscribed: boolean
  }) {
    console.log(`[POST] /api/notification/subscribe`, body)
    
    const success = await this.notificationService.saveSubscription({
      openid: body.openid,
      sessionId: body.sessionId,
      templateType: body.templateType,
      subscribed: body.subscribed,
    })

    return {
      code: success ? 200 : 500,
      msg: success ? '订阅状态已保存' : '保存失败',
      data: { success }
    }
  }

  /**
   * 获取订阅状态
   * GET /api/notification/subscription/:openid/:sessionId/:templateType
   */
  @Get('subscription/:openid/:sessionId/:templateType')
  async getSubscription(
    @Param('openid') openid: string,
    @Param('sessionId') sessionId: string,
    @Param('templateType') templateType: string
  ) {
    console.log(`[GET] /api/notification/subscription`, { openid, sessionId, templateType })
    
    const subscribed = await this.notificationService.getSubscription(
      openid,
      sessionId,
      templateType
    )

    return {
      code: 200,
      msg: '查询成功',
      data: { subscribed }
    }
  }

  /**
   * 手动触发投票结果通知（发起人调用）
   * POST /api/notification/trigger-vote-result
   */
  @Post('trigger-vote-result')
  async triggerVoteResult(@Body() body: {
    sessionId: string
    title: string
    results: Array<{ name: string; votes: number }>
    winner?: string
  }) {
    console.log(`[POST] /api/notification/trigger-vote-result`, body)
    
    const success = await this.notificationService.sendVoteResultNotification({
      sessionId: body.sessionId,
      title: body.title,
      results: body.results,
      winner: body.winner
    })

    return {
      code: success ? 200 : 500,
      msg: success ? '通知已发送' : '发送失败',
      data: { success }
    }
  }

  /**
   * 检测过期投票并发送通知（定时任务调用）
   * GET /api/notification/check-expired
   */
  @Get('check-expired')
  async checkExpired() {
    console.log(`[GET] /api/notification/check-expired`)
    
    const result = await this.notificationService.checkAndProcessExpiredVotes()

    return {
      code: 200,
      msg: '检测完成',
      data: result
    }
  }
}
