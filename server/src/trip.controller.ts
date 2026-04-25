import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common'
import { TripService } from '@/trip.service'
import { ParseService } from '@/parse.service'

@Controller('trip')
export class TripController {
  constructor(
    private readonly tripService: TripService,
    private readonly parseService: ParseService
  ) {}

  // ==================== 灵感管理 ====================

  // 获取灵感列表
  @Get('inspirations')
  async getInspirations(@Query('userId') userId?: string, @Query('primaryTag') primaryTag?: string) {
    const data = await this.tripService.getInspirations(userId, primaryTag)
    console.log(`[GET] /api/trip/inspirations - userId: ${userId}, primaryTag: ${primaryTag}`)
    return { code: 200, msg: 'success', data }
  }

  // 获取灵感统计
  @Get('inspirations/count')
  async getInspirationsCount(@Query('userId') userId?: string) {
    const data = await this.tripService.getInspirationsCount(userId)
    console.log(`[GET] /api/trip/inspirations/count - userId: ${userId}`)
    return { code: 200, msg: 'success', data }
  }

  // 获取收藏列表（必须放在 /inspirations/:id 前面，避免被参数路由匹配）
  @Get('inspirations/favorites')
  async getFavorites(@Query('userId') userId: string) {
    console.log(`[GET] /api/trip/inspirations/favorites - userId: ${userId}`)
    const data = await this.tripService.getFavorites(userId)
    return { code: 200, msg: 'success', data }
  }

  // 获取灵感详情
  @Get('inspirations/:id')
  async getInspirationById(@Param('id') id: string) {
    console.log(`[GET] /api/trip/inspirations/${id}`)
    const data = await this.tripService.getInspirationById(id)
    return { code: 200, msg: 'success', data }
  }

  // 添加灵感（支持链接解析和文字输入）
  @Post('inspirations')
  async addInspiration(@Body() body: { userId?: string; url?: string; text?: string }) {
    console.log(`[POST] /api/trip/inspirations - body:`, JSON.stringify(body))
    
    // 如果有 url 或 text，使用 ParseService 解析
    if (body.url || body.text) {
      const result = await this.parseService.parse(body.userId || '', {
        url: body.url,
        text: body.text
      })
      return { code: 200, msg: 'success', ...result }
    }
    
    // 返回失败（因为缺少必要参数）
    return { code: 400, msg: '请提供 url 或 text 参数' }
  }

  // 智能解析（专门用于粘贴灵感）
  @Post('parse')
  async parseInspiration(@Body() body: { userId: string; url?: string; text?: string }) {
    console.log(`[POST] /api/trip/parse - userId: ${body.userId}`)
    const result = await this.parseService.parse(body.userId, {
      url: body.url,
      text: body.text
    })
    return { code: 200, msg: 'success', ...result }
  }

  // 预览多个灵感点（从字幕中提取）
  @Post('preview')
  async previewInspirations(@Body() body: { userId: string; url?: string; text?: string }) {
    console.log(`[POST] /api/trip/preview - userId: ${body.userId}`)
    const result = await this.parseService.previewMultiple(body.userId, {
      url: body.url,
      text: body.text
    })
    return { code: 200, msg: 'success', ...result }
  }

  // 批量添加灵感
  @Post('inspirations/batch')
  async batchAddInspirations(@Body() body: { items: any[] }) {
    console.log(`[POST] /api/trip/inspirations/batch - items count: ${body.items?.length}`)
    const data = await this.tripService.batchAddInspirations(body.items)
    return { code: 200, msg: 'success', data }
  }

  // 删除灵感
  @Delete('inspirations/:id')
  async deleteInspiration(@Param('id') id: string) {
    console.log(`[DELETE] /api/trip/inspirations/${id}`)
    await this.tripService.deleteInspiration(id)
    return { code: 200, msg: 'success' }
  }

  // 收藏/取消收藏灵感
  @Post('inspirations/:id/favorite')
  async toggleFavorite(@Param('id') id: string, @Body() body: { isFavorite: boolean }) {
    console.log(`[POST] /api/trip/inspirations/${id}/favorite - isFavorite: ${body.isFavorite}`)
    await this.tripService.toggleFavorite(id, body.isFavorite)
    return { code: 200, msg: 'success' }
  }

  // ==================== 路线规划 ====================

  // 基于地理位置的智能路线规划
  @Post('route/plan')
  async planRoute(@Body() body: {
    inspirations: Array<{
      id: string
      title: string
      image?: string
      type?: string
      location?: { name: string; lat: number; lng: number }
      location_str?: string
      rating?: number
      note?: string
    }>
    mainDestination?: string
    days?: number
    startDate?: string
  }) {
    console.log(`[POST] /api/trip/route/plan - inspirations: ${body.inspirations?.length || 0} 个`)
    console.log(`[POST] /api/trip/route/plan - mainDestination: ${body.mainDestination || '未指定'}`)
    console.log(`[POST] /api/trip/route/plan - days: ${body.days || 1}`)

    const result = await this.tripService.planRouteByLocation(
      body.inspirations,
      body.mainDestination,
      body.days || 1
    )

    // 生成分天行程
    const dailyItinerary = this.tripService.generateDailyItinerary(
      result.optimizedRoute,
      body.days || 1,
      body.startDate || new Date().toISOString().split('T')[0]
    )

    console.log(`[POST] /api/trip/route/plan - 完成，生成 ${dailyItinerary.length} 天行程`)

    return {
      code: 200,
      msg: 'success',
      data: {
        route: result.optimizedRoute,
        statistics: result.statistics,
        itinerary: dailyItinerary,
        settings: {
          days: body.days || 1,
          startDate: body.startDate || new Date().toISOString().split('T')[0],
          mainDestination: body.mainDestination
        }
      }
    }
  }

  // ==================== 行程管理 ====================

  // 获取行程列表
  @Get('trips')
  async getTrips(@Query('userId') userId?: string) {
    const data = await this.tripService.getTrips(userId)
    console.log(`[GET] /api/trip/trips - userId: ${userId}`)
    return { code: 200, msg: 'success', data }
  }

  // 创建行程
  @Post('trips')
  async createTrip(@Body() body: any) {
    console.log(`[POST] /api/trip/trips - body:`, JSON.stringify(body))
    const data = await this.tripService.createTrip(body)
    return { code: 200, msg: 'success', data }
  }

  // 获取单个行程
  @Get('trips/:id')
  async getTripById(@Param('id') id: string) {
    const data = await this.tripService.getTrip(id)
    console.log(`[GET] /api/trip/trips/${id}`)
    return { code: 200, msg: 'success', data }
  }

  // 生成路线
  @Post('generate')
  async generateTrip(@Body() body: {
    userId: string
    inspirations: any[]
    settings: {
      start_date: string
      days: number
      budget?: number
      transport_mode: string
    }
  }) {
    console.log(`[POST] /api/trip/generate - settings:`, JSON.stringify(body.settings))
    const data = await this.tripService.generateTripVersions(
      body.userId,
      body.inspirations,
      body.settings
    )
    return { code: 200, msg: 'success', data }
  }

  // 删除行程
  @Delete('trips/:id')
  async deleteTrip(@Param('id') id: string) {
    console.log(`[DELETE] /api/trip/trips/${id}`)
    await this.tripService.deleteTrip(id)
    return { code: 200, msg: 'success' }
  }

  // 确认最终版本
  @Post('trips/:id/confirm')
  async confirmFinalVersion(@Param('id') id: string) {
    console.log(`[POST] /api/trip/trips/${id}/confirm`)
    await this.tripService.confirmFinalVersion(id)
    return { code: 200, msg: 'success' }
  }

  // ==================== 投票管理 ====================

  // 投票
  @Post('vote')
  async vote(@Body() body: {
    trip_id: string
    voter_id: string
    voter_name?: string
    version_id: string
  }) {
    console.log(`[POST] /api/trip/vote - trip_id: ${body.trip_id}, version_id: ${body.version_id}`)
    await this.tripService.vote(body)
    return { code: 200, msg: 'success' }
  }

  // 获取投票结果
  @Get('votes/:tripId/results')
  async getVoteResults(@Param('tripId') tripId: string) {
    const data = await this.tripService.getVoteResults(tripId)
    console.log(`[GET] /api/trip/votes/${tripId}/results`)
    return { code: 200, msg: 'success', data }
  }

  // 获取用户投票
  @Get('votes/:tripId/user/:voterId')
  async getUserVote(@Param('tripId') tripId: string, @Param('voterId') voterId: string) {
    const data = await this.tripService.getUserVote(tripId, voterId)
    console.log(`[GET] /api/trip/votes/${tripId}/user/${voterId}`)
    return { code: 200, msg: 'success', data }
  }
}
