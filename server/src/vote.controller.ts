import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common'
import { VoteService, InspirationPoint } from '@/vote.service'

@Controller('vote')
export class VoteController {
  constructor(private readonly voteService: VoteService) {}

  /**
   * 创建投票会话
   * POST /api/vote/sessions
   */
  @Post('sessions')
  async createSession(@Body() body: {
    tripId: string
    title: string
    creatorName?: string
    inspirationPoints: InspirationPoint[]
    startDate?: string // 旅行开始日期 YYYY-MM-DD
    endDate?: string   // 旅行结束日期 YYYY-MM-DD
    meetupPlace?: string[] // 集合地点标签数组
    voteDeadline?: string  // 投票截止时间 ISO8601 格式
  }) {
    const result = await this.voteService.createSession({
      tripId: body.tripId,
      title: body.title,
      creatorName: body.creatorName,
      inspirationPoints: body.inspirationPoints,
      startDate: body.startDate,
      endDate: body.endDate,
      meetupPlace: body.meetupPlace,
      voteDeadline: body.voteDeadline,
    })

    return {
      code: 200,
      msg: '创建成功',
      data: result,
    }
  }

  /**
   * 获取投票会话（通过分享码）
   * GET /api/vote/sessions/:shareCode
   */
  @Get('sessions/:shareCode')
  async getSession(@Param('shareCode') shareCode: string) {
    const session = await this.voteService.getSessionByShareCode(shareCode)

    if (!session) {
      return {
        code: 404,
        msg: '投票链接已失效或不存在',
        data: null,
      }
    }

    return {
      code: 200,
      msg: '获取成功',
      data: session,
    }
  }

  /**
   * 提交投票
   * POST /api/vote/submit
   */
  @Post('submit')
  async submitVotes(@Body() body: {
    sessionId: string
    shareCode: string
    voterOpenid?: string
    voterName?: string
    votes: Array<{ inspirationId: string; inspirationTitle: string; voteValue: number }>
  }) {
    // 验证分享码
    const session = await this.voteService.getSessionByShareCode(body.shareCode)
    if (!session) {
      return {
        code: 400,
        msg: '投票链接已失效或不存在',
        data: null,
      }
    }

    if (session.sessionId !== body.sessionId) {
      return {
        code: 400,
        msg: '会话ID不匹配',
        data: null,
      }
    }

    const result = await this.voteService.submitVotes({
      sessionId: body.sessionId,
      voterOpenid: body.voterOpenid,
      voterName: body.voterName,
      votes: body.votes,
    })

    return {
      code: 200,
      msg: '投票成功',
      data: result,
    }
  }

  /**
   * 获取投票结果
   * GET /api/vote/results/:sessionId
   */
  @Get('results/:sessionId')
  async getVoteResults(
    @Param('sessionId') sessionId: string,
    @Query('openid') openid?: string,
  ) {
    const results = await this.voteService.getVoteResults(sessionId, openid)

    return {
      code: 200,
      msg: '获取成功',
      data: results,
    }
  }

  /**
   * 获取投票统计
   * GET /api/vote/stats/:sessionId
   */
  @Get('stats/:sessionId')
  async getVoteStats(@Param('sessionId') sessionId: string) {
    const results = await this.voteService.getVoteResults(sessionId)
    const voterCount = await this.voteService.getVoterCount(sessionId)

    const totalVotes = results.reduce((sum, r) => sum + r.likes + r.dislikes, 0)
    const avgPercentage = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
      : 0

    return {
      code: 200,
      msg: '获取成功',
      data: {
        voterCount,
        totalVotes,
        avgPercentage,
        itemCount: results.length,
      },
    }
  }
}
