import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { MapService } from '@/map.service'

// 类型定义
interface InspirationInput {
  user_id?: string
  title: string
  image?: string
  source?: string
  type?: string
  location?: { name: string; lat: number; lng: number }
  time?: string
  price?: number
  rating?: number
}

interface TripInput {
  user_id?: string
  version_name?: string
  content: any[]
  settings?: {
    start_date: string
    days: number
    budget?: number
    transport_mode: string
  }
}

interface VoteInput {
  trip_id: string
  voter_id: string
  voter_name?: string
  version_id: string
}

@Injectable()
export class TripService {
  private get client() {
    return getSupabaseClient()
  }

  constructor(private readonly mapService: MapService) {}

  // ==================== 灵感管理 ====================

  // 获取灵感列表
  async getInspirations(userId?: string, primaryTag?: string) {
    let query = this.client.from('inspirations').select('*')
    if (userId) {
      query = query.eq('user_id', userId)
    }
    if (primaryTag) {
      query = query.eq('primary_tag', primaryTag)
    }
    const { data, error } = await query.order('create_time', { ascending: false })
    if (error) throw new Error(`获取灵感失败: ${error.message}`)
    return data
  }

  // 获取灵感统计（按一级标签分组计数）
  async getInspirationsCount(userId?: string) {
    const { data, error } = await this.client
      .from('inspirations')
      .select('primary_tag')
      .eq('user_id', userId || '')
    
    if (error) {
      console.error('[TripService] 获取灵感统计失败:', JSON.stringify(error))
      return []
    }
    
    // 按 primary_tag 分组计数
    const countMap = new Map<string, number>()
    for (const item of data || []) {
      const tag = item.primary_tag || '景点'
      countMap.set(tag, (countMap.get(tag) || 0) + 1)
    }
    
    const result = Array.from(countMap.entries()).map(([primary_tag, count]) => ({
      primary_tag,
      count
    }))
    
    console.log(`[TripService] 灵感统计:`, JSON.stringify(result))
    return result
  }

  // 获取灵感详情
  async getInspirationById(id: string) {
    const { data, error } = await this.client
      .from('inspirations')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      console.error(`[TripService] 获取灵感详情失败 (id: ${id}):`, JSON.stringify(error))
      return null
    }
    
    console.log(`[TripService] 获取灵感详情 (id: ${id}):`, JSON.stringify(data))
    return data
  }

  // 添加灵感
  async addInspiration(input: InspirationInput) {
    const { data, error } = await this.client
      .from('inspirations')
      .insert(input)
      .select()
      .single()
    if (error) throw new Error(`添加灵感失败: ${error.message}`)
    return data
  }

  // 删除灵感
  async deleteInspiration(id: string) {
    const { error } = await this.client
      .from('inspirations')
      .delete()
      .eq('id', id)
    if (error) throw new Error(`删除灵感失败: ${error.message}`)
    return { success: true }
  }

  // 切换收藏状态
  async toggleFavorite(id: string, isFavorite: boolean) {
    const { error } = await this.client
      .from('inspirations')
      .update({ is_favorite: isFavorite })
      .eq('id', id)
    if (error) throw new Error(`更新收藏状态失败: ${error.message}`)
    return { success: true }
  }

  // 获取收藏列表
  async getFavorites(userId: string) {
    const { data, error } = await this.client
      .from('inspirations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_favorite', true)
      .order('create_time', { ascending: false })
    if (error) throw new Error(`获取收藏列表失败: ${error.message}`)
    return data
  }

  // 批量添加灵感
  async batchAddInspirations(inputs: InspirationInput[]) {
    console.log(`[TripService] batchAddInspirations - 准备插入 ${inputs.length} 条记录`)
    console.log(`[TripService] 示例数据:`, JSON.stringify(inputs[0]))
    
    const { data, error } = await this.client
      .from('inspirations')
      .insert(inputs)
      .select()
    
    if (error) {
      console.error(`[TripService] Supabase 错误:`, JSON.stringify(error))
      throw new Error(`批量添加灵感失败: ${error.message}`)
    }
    
    console.log(`[TripService] 插入成功，返回 ${data?.length || 0} 条记录`)
    return data
  }

  // ==================== 行程管理 ====================

  // 获取行程列表
  async getTrips(userId?: string) {
    let query = this.client.from('trips').select('*')
    if (userId) {
      query = query.eq('user_id', userId)
    }
    const { data, error } = await query.order('create_time', { ascending: false })
    if (error) throw new Error(`获取行程失败: ${error.message}`)
    return data
  }

  // 创建行程版本
  async createTrip(input: TripInput) {
    const { data, error } = await this.client
      .from('trips')
      .insert(input)
      .select()
      .single()
    if (error) throw new Error(`创建行程失败: ${error.message}`)
    return data
  }

  // 获取单个行程
  async getTrip(id: string) {
    const { data, error } = await this.client
      .from('trips')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(`获取行程失败: ${error.message}`)
    return data
  }

  // 生成多个路线版本
  async generateTripVersions(
    userId: string,
    inspirations: any[],
    settings: TripInput['settings']
  ) {
    // 根据灵感数量和设置生成多个版本
    const versions = this.generateVersions(inspirations, settings)
    
    const results: any[] = []
    for (const version of versions) {
      const result = await this.createTrip({
        user_id: userId,
        version_name: version.name,
        content: version.content,
        settings
      })
      results.push(result)
    }
    
    return results
  }

  // 生成路线算法（简单版本，按地理位置聚类）
  private generateVersions(
    inspirations: any[],
    settings: TripInput['settings']
  ) {
    if (!settings || !settings.days) {
      return [{
        name: '默认方案',
        content: [{ day: 1, date: settings?.start_date || '', items: [] as any[] }]
      }] as { name: string; content: any[] }[]
    }

    const days = settings.days
    const versions: { name: string; content: any[] }[] = []

    // 版本1：经典打卡线 - 按热度排序
    const byRating = [...inspirations]
      .filter(i => i.rating)
      .sort((a, b) => b.rating - a.rating)
    versions.push({
      name: '经典打卡线',
      content: this.distributeByDays(byRating, days, settings.start_date)
    })

    // 版本2：文艺休闲线 - 按类型分组
    const byType = [...inspirations].sort((a, b) => {
      const typeOrder = ['hotel', 'food', 'spot', 'show']
      return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
    })
    versions.push({
      name: '文艺休闲线',
      content: this.distributeByDays(byType, days, settings.start_date)
    })

    // 版本3：美食探索线 - 优先美食
    const byFood = [...inspirations].sort((a, b) => {
      if (a.type === 'food' && b.type !== 'food') return -1
      if (b.type === 'food' && a.type !== 'food') return 1
      return 0
    })
    versions.push({
      name: '美食探索线',
      content: this.distributeByDays(byFood, days, settings.start_date)
    })

    return versions.slice(0, 3)
  }

  // 按天数分配行程项
  private distributeByDays(
    items: any[],
    days: number,
    startDate: string
  ): { day: number; date: string; items: any[] }[] {
    const result: { day: number; date: string; items: any[] }[] = []
    const itemsPerDay = Math.ceil(items.length / days)

    for (let i = 0; i < days; i++) {
      const dayItems = items.slice(i * itemsPerDay, (i + 1) * itemsPerDay)
      const date = this.addDays(startDate || new Date().toISOString(), i)

      result.push({
        day: i + 1,
        date,
        items: dayItems.map((item, index) => ({
          id: `${item.id}_${i}_${index}`,
          inspiration_id: item.id,
          title: item.title,
          image: item.image || '',
          location: item.location || { name: '', lat: 0, lng: 0 },
          start_time: this.calculateTime(9 + index * 3),
          duration: item.type === 'show' ? 180 : 120,
          type: item.type,
          note: item.note
        }))
      })
    }

    return result
  }

  // 日期加天数
  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr)
    date.setDate(date.getDate() + days)
    return date.toISOString().split('T')[0]
  }

  // 计算时间
  private calculateTime(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`
  }

  // 删除行程
  async deleteTrip(id: string) {
    const { error } = await this.client
      .from('trips')
      .delete()
      .eq('id', id)
    if (error) throw new Error(`删除行程失败: ${error.message}`)
    return { success: true }
  }

  // 确认最终版本
  async confirmFinalVersion(tripId: string) {
    // 先将所有版本 is_final 设为 false
    const { data: trips, error: listError } = await this.client
      .from('trips')
      .select('id')
      .eq('user_id', (await this.getTrip(tripId))?.user_id)
    if (listError) throw new Error(`查询行程失败: ${listError.message}`)

    for (const trip of trips || []) {
      await this.client
        .from('trips')
        .update({ is_final: false })
        .eq('id', trip.id)
    }

    // 确认选中版本
    const { error } = await this.client
      .from('trips')
      .update({ is_final: true })
      .eq('id', tripId)
    if (error) throw new Error(`确认版本失败: ${error.message}`)
    
    return { success: true }
  }

  // ==================== 地理位置路线规划 ====================

  // 模拟坐标（当没有配置高德 KEY 时使用）
  private getMockLocation(name: string): { lat: number; lng: number } {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i)
      hash = hash & hash
    }
    const lat = 30 + (hash % 100) / 100 * 10
    const lng = 110 + ((hash >> 8) % 100) / 100 * 20
    return { lat, lng }
  }

  // 计算两点间距离（公里）
  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371
    const dLat = (point2.lat - point1.lat) * Math.PI / 180
    const dLng = (point2.lng - point1.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // 基于地理位置的智能路线规划（使用实际道路距离）
  async planRouteByLocation(
    inspirations: Array<{
      id: string
      title: string
      image?: string
      type?: string
      location?: { name: string; lat: number; lng: number }
      location_str?: string
      rating?: number
      note?: string
    }>,
    mainDestination?: string,
    days: number = 1
  ): Promise<{
    optimizedRoute: Array<{
      id: string
      title: string
      image?: string
      type?: string
      location: { name: string; lat: number; lng: number }
      locationSource: 'original' | 'mock'
    }>
    statistics: {
      totalPoints: number
      locatedPoints: number
    }
  }> {
    console.log(`[TripService] 路线规划开始，共 ${inspirations.length} 个灵感点，目标 ${days} 天`)

    // 类型定义
    type PointWithCoords = {
      id: string
      title: string
      image?: string
      type?: string
      location: { name: string; lat: number; lng: number }
      locationSource: 'original' | 'mock'
      note?: string
    }

    // 获取每个点的坐标
    const pointsWithCoords: PointWithCoords[] = inspirations.map(ins => {
      if (ins.location && ins.location.lat && ins.location.lng) {
        return {
          id: ins.id,
          title: ins.title,
          image: ins.image,
          type: ins.type,
          location: ins.location,
          locationSource: 'original' as const,
          note: ins.note
        }
      }
      // 使用模拟坐标
      const mockLoc = this.getMockLocation(ins.title)
      return {
        id: ins.id,
        title: ins.title,
        image: ins.image,
        type: ins.type,
        location: { name: ins.location_str || ins.title, ...mockLoc },
        locationSource: 'mock' as const,
        note: ins.note
      }
    })

    // 过滤有效点
    const validPoints = pointsWithCoords.filter(p => p.location.lat && p.location.lng)
    console.log(`[TripService] 有效点数: ${validPoints.length}`)

    if (validPoints.length === 0) {
      return {
        optimizedRoute: [],
        statistics: { totalPoints: inspirations.length, locatedPoints: 0 }
      }
    }

    // 按地理位置聚类分组（按天）
    const clusters = this.clusterByLocation(validPoints, days)

    // 对每个簇内按最近邻算法排序
    const optimizedRoute: Array<{
      id: string
      title: string
      image?: string
      type?: string
      location: { name: string; lat: number; lng: number }
      locationSource: 'original' | 'mock'
    }> = []

    for (const cluster of clusters) {
      if (cluster.length === 0) continue

      // 按最近邻排序
      const sorted = this.nearestNeighborSort(cluster)

      for (let i = 0; i < sorted.length; i++) {
        const point = sorted[i]
        optimizedRoute.push(point)
      }
    }

    console.log(`[TripService] 路线规划完成`)

    return {
      optimizedRoute,
      statistics: {
        totalPoints: inspirations.length,
        locatedPoints: validPoints.length
      }
    }
  }

  // 按地理位置聚类
  private clusterByLocation<T extends { location: { lat: number; lng: number } }>(
    points: T[],
    days: number
  ): T[][] {
    if (points.length === 0) return []
    if (days <= 0 || points.length <= days) return [points]

    // 计算所有点的中心
    const center = {
      lat: points.reduce((sum, p) => sum + p.location.lat, 0) / points.length,
      lng: points.reduce((sum, p) => sum + p.location.lng, 0) / points.length
    }

    // 计算每个点到中心的方位角
    const pointsWithAngle = points.map(p => ({
      point: p,
      angle: Math.atan2(p.location.lat - center.lat, p.location.lng - center.lng)
    }))

    // 按方位角排序
    pointsWithAngle.sort((a, b) => a.angle - b.angle)

    // 将点分配到不同的簇（按扇形区域）
    const clusters: T[][] = Array.from({ length: days }, () => [])
    const pointsPerCluster = Math.ceil(points.length / days)

    pointsWithAngle.forEach((item, index) => {
      const clusterIndex = Math.floor(index / pointsPerCluster)
      if (clusterIndex < days) {
        clusters[clusterIndex].push(item.point)
      }
    })

    return clusters
  }

  // 最近邻排序算法
  private nearestNeighborSort<T extends { location: { lat: number; lng: number } }>(
    points: T[]
  ): T[] {
    if (points.length <= 1) return [...points]

    const route: T[] = []
    const remaining = [...points]

    // 选择最南边的点作为起点
    let current = remaining.reduce((min, p) =>
      p.location.lat < min.location.lat ? p : min
    )
    route.push(current)
    remaining.splice(remaining.findIndex(p => p === current), 1)

    while (remaining.length > 0) {
      let nearestIndex = 0
      let nearestDist = Infinity

      for (let i = 0; i < remaining.length; i++) {
        const dist = this.calculateDistance(current.location, remaining[i].location)
        if (dist < nearestDist) {
          nearestDist = dist
          nearestIndex = i
        }
      }

      current = remaining.splice(nearestIndex, 1)[0]
      route.push(current)
    }

    return route
  }

  // 根据优化路线生成分天行程
  generateDailyItinerary(
    route: Array<{
      id: string
      title: string
      image?: string
      type?: string
      location: { name: string; lat: number; lng: number }
      locationSource?: 'original' | 'mock'
      note?: string
    }>,
    days: number,
    startDate: string
  ): Array<{
    day: number
    date: string
    items: Array<{
      id: string
      inspirationId: string
      title: string
      image: string
      location: { name: string; lat: number; lng: number }
      type: string
      startTime: string
      duration: number
      note?: string
    }>
  }> {
    if (route.length === 0) return []

    const itemsPerDay = Math.ceil(route.length / days)
    const result: Array<{
      day: number
      date: string
      items: any[]
    }> = []

    for (let i = 0; i < days; i++) {
      const dayItems = route.slice(i * itemsPerDay, (i + 1) * itemsPerDay)
      if (dayItems.length === 0) continue

      const date = this.addDays(startDate, i)

      result.push({
        day: i + 1,
        date,
        items: dayItems.map((item, index) => ({
          id: `${item.id}_d${i + 1}_${index}`,
          inspirationId: item.id,
          title: item.title,
          image: item.image || '',
          location: item.location,
          type: item.type || 'spot',
          startTime: this.calculateTime(9 + index * 2), // 每项间隔2小时
          duration: item.type === 'food' ? 90 : 120,
          note: item.note
        }))
      })
    }

    return result
  }

  // ==================== 投票管理 ====================

  // 投票
  async vote(input: VoteInput) {
    // 检查是否已投票
    const { data: existing } = await this.client
      .from('votes')
      .select('id')
      .eq('trip_id', input.trip_id)
      .eq('voter_id', input.voter_id)
      .maybeSingle()

    if (existing) {
      // 已投票，更新投票
      await this.client
        .from('votes')
        .update({ version_id: input.version_id })
        .eq('id', existing.id)

      // 更新原版本票数
      const { data: oldVote } = await this.client
        .from('votes')
        .select('version_id')
        .eq('id', existing.id)
        .single()

      if (oldVote) {
        await this.decreaseVoteCount(input.trip_id, oldVote.version_id)
      }
    } else {
      // 新投票
      await this.client.from('votes').insert({
        trip_id: input.trip_id,
        voter_id: input.voter_id,
        voter_name: input.voter_name || '匿名用户',
        version_id: input.version_id
      })
    }

    // 增加新版本票数
    await this.increaseVoteCount(input.trip_id, input.version_id)

    return { success: true }
  }

  // 获取投票结果
  async getVoteResults(tripId: string) {
    const { data, error } = await this.client
      .from('votes')
      .select('*')
      .eq('trip_id', tripId)
    if (error) throw new Error(`获取投票结果失败: ${error.message}`)

    // 统计每个版本的票数
    const voteCounts: Record<string, number> = {}
    for (const vote of data || []) {
      voteCounts[vote.version_id] = (voteCounts[vote.version_id] || 0) + 1
    }

    return voteCounts
  }

  // 获取某人的投票
  async getUserVote(tripId: string, voterId: string) {
    const { data, error } = await this.client
      .from('votes')
      .select('*')
      .eq('trip_id', tripId)
      .eq('voter_id', voterId)
      .maybeSingle()
    if (error) throw new Error(`获取投票失败: ${error.message}`)
    return data
  }

  // 增加票数
  private async increaseVoteCount(tripId: string, versionId: string) {
    const { data, error } = await this.client
      .from('trips')
      .select('id, vote_count')
      .eq('id', versionId)
      .single()
    if (error) throw new Error(`获取行程失败: ${error.message}`)

    await this.client
      .from('trips')
      .update({ vote_count: (data?.vote_count || 0) + 1 })
      .eq('id', versionId)
  }

  // 减少票数
  private async decreaseVoteCount(tripId: string, versionId: string) {
    const { data, error } = await this.client
      .from('trips')
      .select('id, vote_count')
      .eq('id', versionId)
      .single()
    if (error) throw new Error(`获取行程失败: ${error.message}`)

    if (data?.vote_count > 0) {
      await this.client
        .from('trips')
        .update({ vote_count: data.vote_count - 1 })
        .eq('id', versionId)
    }
  }
}
