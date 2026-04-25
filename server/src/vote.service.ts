import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { v4 as uuidv4 } from 'uuid'

// 生成随机分享码
function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export interface InspirationPoint {
  id: string
  title: string
  image?: string
  location?: { name: string; lat: number; lng: number }
  type?: string
  primaryTag?: string
  price?: string
  rating?: number
}

export interface VoteResult {
  inspirationId: string
  inspirationTitle: string
  likes: number
  dislikes: number
  percentage: number
  userVote?: number // 1=喜欢, -1=不喜欢, 0=未投票
}

@Injectable()
export class VoteService {
  private get client() {
    return getSupabaseClient()
  }

  /**
   * 创建投票会话
   */
  async createSession(params: {
    tripId: string
    title: string
    creatorName?: string
    inspirationPoints: InspirationPoint[]
    startDate?: string // 旅行开始日期 YYYY-MM-DD
    endDate?: string   // 旅行结束日期 YYYY-MM-DD（可以和开始日期相同）
    meetupPlace?: string[] // 集合地点标签数组
    voteDeadline?: string  // 投票截止时间 ISO8601 格式
  }): Promise<{ shareCode: string; sessionId: string; voteDeadline: string }> {
    const { tripId, title, creatorName, inspirationPoints, startDate, endDate, meetupPlace, voteDeadline } = params
    const client = this.client

    // 生成唯一分享码
    let shareCode = generateShareCode()
    let attempts = 0
    while (attempts < 10) {
      const { data: existing } = await client
        .from('vote_sessions')
        .select('id')
        .eq('share_code', shareCode)
        .maybeSingle()
      
      if (!existing) break
      shareCode = generateShareCode()
      attempts++
    }

    const sessionId = uuidv4()
    
    // 处理投票截止时间
    let deadline: Date
    if (voteDeadline) {
      deadline = new Date(voteDeadline)
    } else {
      // 默认截止时间：7天后
      deadline = new Date()
      deadline.setDate(deadline.getDate() + 7)
    }

    const { error } = await client
      .from('vote_sessions')
      .insert({
        id: sessionId,
        trip_id: tripId,
        share_code: shareCode,
        title,
        creator_name: creatorName || '旅行达人',
        inspirationPoints: inspirationPoints,
        start_date: startDate,
        end_date: endDate,
        meetup_place: meetupPlace || [],
        vote_deadline: deadline.toISOString(),
      })

    if (error) {
      console.error('[VoteService] 创建投票会话失败:', error)
      throw new Error(`创建投票会话失败: ${error.message}`)
    }

    console.log(`[VoteService] 创建投票会话成功: ${shareCode}, 截止时间: ${deadline.toISOString()}`)
    return { shareCode, sessionId, voteDeadline: deadline.toISOString() }
  }

  /**
   * 根据分享码获取投票会话
   */
  async getSessionByShareCode(shareCode: string): Promise<{
    sessionId: string
    tripId: string
    title: string
    creatorName: string
    inspirationPoints: InspirationPoint[]
    startDate?: string
    endDate?: string
    meetupPlace?: string[]
    voteDeadline: string
    isExpired: boolean // 投票是否已截止
  } | null> {
    const client = this.client

    const { data, error } = await client
      .from('vote_sessions')
      .select('id, trip_id, title, creator_name, inspirationPoints, start_date, end_date, meetup_place, vote_deadline')
      .eq('share_code', shareCode)
      .maybeSingle()

    if (error) {
      console.error('[VoteService] 查询投票会话失败:', error)
      throw new Error(`查询投票会话失败: ${error.message}`)
    }

    if (!data) return null

    const now = new Date()
    const deadline = new Date(data.vote_deadline)
    const isExpired = now > deadline

    return {
      sessionId: data.id,
      tripId: data.trip_id,
      title: data.title,
      creatorName: data.creator_name,
      inspirationPoints: data.inspirationPoints,
      startDate: data.start_date,
      endDate: data.end_date,
      meetupPlace: data.meetup_place || [],
      voteDeadline: data.vote_deadline,
      isExpired,
    }
  }

  /**
   * 提交投票（支持批量投票）
   */
  async submitVotes(params: {
    sessionId: string
    voterOpenid?: string
    voterName?: string
    votes: Array<{ inspirationId: string; inspirationTitle: string; voteValue: number }>
  }): Promise<{ success: boolean; voteCount: number }> {
    const { sessionId, voterOpenid, voterName, votes } = params
    const client = this.client

    const insertData = votes.map(vote => ({
      id: uuidv4(),
      session_id: sessionId,
      inspiration_id: vote.inspirationId,
      inspiration_title: vote.inspirationTitle,
      voter_openid: voterOpenid || null,
      voter_name: voterName || '微信用户',
      vote_value: vote.voteValue, // 1=喜欢, -1=不喜欢
    }))

    // 使用 upsert 避免重复投票
    const { error } = await client
      .from('vote_records')
      .upsert(insertData, {
        onConflict: 'session_id,inspiration_id,voter_openid',
      })

    if (error) {
      console.error('[VoteService] 提交投票失败:', error)
      throw new Error(`提交投票失败: ${error.message}`)
    }

    console.log(`[VoteService] 投票成功: session=${sessionId}, count=${votes.length}`)
    return { success: true, voteCount: votes.length }
  }

  /**
   * 获取投票结果（带用户投票状态）
   */
  async getVoteResults(sessionId: string, voterOpenid?: string): Promise<VoteResult[]> {
    const client = this.client

    // 获取会话信息
    const { data: session, error: sessionError } = await client
      .from('vote_sessions')
      .select('inspirationPoints')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionError) {
      console.error('[VoteService] 查询会话失败:', sessionError)
      throw new Error(`查询会话失败: ${sessionError.message}`)
    }

    if (!session) {
      throw new Error('投票会话不存在或已过期')
    }

    // 获取所有投票记录
    const { data: records, error: recordsError } = await client
      .from('vote_records')
      .select('inspiration_id, inspiration_title, vote_value, voter_openid')
      .eq('session_id', sessionId)

    if (recordsError) {
      console.error('[VoteService] 查询投票记录失败:', recordsError)
      throw new Error(`查询投票记录失败: ${recordsError.message}`)
    }

    // 按灵感点分组统计
    const inspirationPoints = session.inspirationPoints as InspirationPoint[]
    const results: VoteResult[] = inspirationPoints.map(point => {
      const pointRecords = records?.filter(r => r.inspiration_id === point.id) || []
      const likes = pointRecords.filter(r => r.vote_value === 1).length
      const dislikes = pointRecords.filter(r => r.vote_value === -1).length
      const total = likes + dislikes
      const percentage = total > 0 ? Math.round((likes / total) * 100) : 0

      // 检查当前用户是否投票
      let userVote = 0
      if (voterOpenid) {
        const userRecord = pointRecords.find(r => r.voter_openid === voterOpenid)
        if (userRecord) {
          userVote = userRecord.vote_value
        }
      }

      return {
        inspirationId: point.id,
        inspirationTitle: point.title,
        likes,
        dislikes,
        percentage,
        userVote,
      }
    })

    return results
  }

  /**
   * 获取投票会话的参与者数量
   */
  async getVoterCount(sessionId: string): Promise<number> {
    const client = this.client

    const { data, error } = await client
      .from('vote_records')
      .select('voter_openid', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .not('voter_openid', 'is', null)

    if (error) {
      console.error('[VoteService] 统计投票人数失败:', error)
      return 0
    }

    return data?.length || 0
  }
}
