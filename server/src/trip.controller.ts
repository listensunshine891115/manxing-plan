import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common'
import { TripService } from '@/trip.service'

@Controller('trip')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  // ==================== 灵感管理 ====================

  // 获取灵感列表
  @Get('inspirations')
  async getInspirations(@Query('userId') userId?: string) {
    const data = await this.tripService.getInspirations(userId)
    console.log(`[GET] /api/trip/inspirations - userId: ${userId}`)
    return { code: 200, msg: 'success', data }
  }

  // 添加灵感
  @Post('inspirations')
  async addInspiration(@Body() body: any) {
    console.log(`[POST] /api/trip/inspirations - body:`, JSON.stringify(body))
    const data = await this.tripService.addInspiration(body)
    return { code: 200, msg: 'success', data }
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

  // ==================== 行程管理 ====================

  // 获取行程列表
  @Get('trips')
  async getTrips(@Query('userId') userId?: string) {
    const data = await this.tripService.getTrips(userId)
    console.log(`[GET] /api/trip/trips - userId: ${userId}`)
    return { code: 200, msg: 'success', data }
  }

  // 获取单个行程
  @Get('trips/:id')
  async getTripById(@Param('id') id: string) {
    const data = await this.tripService.getTripById(id)
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
