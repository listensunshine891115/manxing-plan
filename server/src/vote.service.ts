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
    expiresDays?: number // 过期天数，默认7天
  }): Promise<{ shareCode: string; sessionId: string }> {
    const { tripId, title, creatorName, inspirationPoints, expiresDays = 7 } = params
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

    // 计算过期时间
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresDays)

    const sessionId = uuidv4()

    const { error } = await client
      .from('vote_sessions')
      .insert({
        id: sessionId,
        trip_id: tripId,
        share_code: shareCode,
        title,
        creator_name: creatorName || '旅行达人',
        inspirationPoints: inspirationPoints,
        expires_at: expiresAt.toISOString(),
      })

    if (error) {
      console.error('[VoteService] 创建投票会话失败:', error)
      throw new Error(`创建投票会话失败: ${error.message}`)
    }

    console.log(`[VoteService] 创建投票会话成功: ${shareCode}`)
    return { shareCode, sessionId }
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
    expiresAt: string
  } | null> {
    const client = this.client

    const { data, error } = await client
      .from('vote_sessions')
      .select('id, trip_id, title, creator_name, inspirationPoints, expires_at')
      .eq('share_code', shareCode)
      .maybeSingle()

    if (error) {
      console.error('[VoteService] 查询投票会话失败:', error)
      throw new Error(`查询投票会话失败: ${error.message}`)
    }

    if (!data) return null

    // 检查是否过期
    if (new Date(data.expires_at) < new Date()) {
      return null
    }

    return {
      sessionId: data.id,
      tripId: data.trip_id,
      title: data.title,
      creatorName: data.creator_name,
      inspirationPoints: data.inspirationPoints,
      expiresAt: data.expires_at,
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
