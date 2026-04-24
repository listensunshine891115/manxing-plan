import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

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

  // 获取单个行程
  async getTripById(id: string) {
    const { data, error } = await this.client
      .from('trips')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(`获取行程详情失败: ${error.message}`)
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
      .eq('user_id', (await this.getTripById(tripId))?.user_id)
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
