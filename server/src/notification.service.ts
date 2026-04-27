import { Injectable, OnModuleInit } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createClient } from '@supabase/supabase-js'

// 微信订阅消息模板ID（需要在小程序后台配置）
const VOTE_RESULT_TEMPLATE_ID = 'YOUR_VOTE_TEMPLATE_ID' // 投票结果通知模板
const VOTE_REMINDER_TEMPLATE_ID = 'YOUR_REMINDER_TEMPLATE_ID' // 投票提醒模板

export interface SubscribeParams {
  openid: string
  sessionId: string
  templateType: 'vote_result' | 'vote_reminder'
  subscribed: boolean
}

export interface NotificationData {
  openid: string
  templateId: string
  page?: string
  data: Record<string, { value: string }>
}

@Injectable()
export class NotificationService implements OnModuleInit {
  private supabase: ReturnType<typeof createClient>
  
  onModuleInit() {
    const url = process.env.SUPABASE_URL || process.env.COZE_SUPABASE_URL
    const key = process.env.SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY
    if (url && key) {
      this.supabase = createClient(url, key)
    }
  }

  private getClient() {
    if (!this.supabase) {
      this.supabase = getSupabaseClient()
    }
    return this.supabase
  }

  /**
   * 保存用户订阅状态
   */
  async saveSubscription(params: SubscribeParams): Promise<boolean> {
    const client = this.getClient()
    
    const { error } = await client
      .from('user_subscriptions')
      .upsert({
        openid: params.openid,
        session_id: params.sessionId,
        template_type: params.templateType,
        subscribed: params.subscribed,
        subscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'openid,session_id,template_type'
      })

    if (error) {
      console.error('[NotificationService] 保存订阅状态失败:', error)
      return false
    }

    console.log(`[NotificationService] 保存订阅状态成功: ${params.openid}, ${params.templateType}`)
    return true
  }

  /**
   * 获取用户订阅状态
   */
  async getSubscription(openid: string, sessionId: string, templateType: string): Promise<boolean> {
    const client = this.getClient()
    
    const { data, error } = await client
      .from('user_subscriptions')
      .select('subscribed')
      .eq('openid', openid)
      .eq('session_id', sessionId)
      .eq('template_type', templateType)
      .eq('subscribed', true)
      .maybeSingle()

    if (error) {
      console.error('[NotificationService] 查询订阅状态失败:', error)
      return false
    }

    return !!data
  }

  /**
   * 获取会话的所有订阅用户
   */
  async getSubscribedUsers(sessionId: string): Promise<string[]> {
    const client = this.getClient()
    
    const { data, error } = await client
      .from('user_subscriptions')
      .select('openid')
      .eq('session_id', sessionId)
      .eq('subscribed', true)

    if (error) {
      console.error('[NotificationService] 获取订阅用户失败:', error)
      return []
    }

    return data?.map(d => d.openid) || []
  }

  /**
   * 发送投票结果通知
   * 注意：实际发送需要微信 access_token，此处记录通知任务
   */
  async sendVoteResultNotification(params: {
    sessionId: string
    title: string
    results: Array<{ name: string; votes: number }>
    winner?: string
  }): Promise<boolean> {
    const client = this.getClient()
    const subscribedUsers = await this.getSubscribedUsers(params.sessionId)
    
    if (subscribedUsers.length === 0) {
      console.log(`[NotificationService] 会话 ${params.sessionId} 没有订阅用户，跳过通知`)
      return true
    }

    // 记录通知任务（实际发送由微信服务器处理）
    const notifications: NotificationData[] = subscribedUsers.map(openid => ({
      openid,
      templateId: VOTE_RESULT_TEMPLATE_ID,
      page: `pages/vote/result?sessionId=${params.sessionId}`,
      data: {
        thing1: { value: params.title.slice(0, 20) }, // 投票标题
        phrase2: { value: '投票已结束' }, // 状态
        time3: { value: new Date().toLocaleString('zh-CN') }, // 通知时间
        thing4: { value: params.winner ? `热门选择：${params.winner}` : '查看投票结果' }, // 结果
      }
    }))

    // 保存通知记录
    const { error } = await client
      .from('notification_queue')
      .insert(notifications.map(n => ({
        openid: n.openid,
        session_id: params.sessionId,
        template_id: n.templateId,
        page: n.page,
        data: n.data,
        status: 'pending',
        created_at: new Date().toISOString(),
      })))

    if (error) {
      console.error('[NotificationService] 保存通知任务失败:', error)
      return false
    }

    console.log(`[NotificationService] 已创建 ${notifications.length} 个通知任务`)
    return true
  }

  /**
   * 发送投票提醒通知
   */
  async sendVoteReminderNotification(params: {
    sessionId: string
    title: string
    deadline: string
    remainingVoters: number
  }): Promise<boolean> {
    const client = this.getClient()
    const subscribedUsers = await this.getSubscribedUsers(params.sessionId)
    
    if (subscribedUsers.length === 0) {
      return true
    }

    const notifications = subscribedUsers.map(openid => ({
      openid,
      templateId: VOTE_REMINDER_TEMPLATE_ID,
      page: `pages/vote/index?sessionId=${params.sessionId}`,
      data: {
        thing1: { value: params.title.slice(0, 20) },
        time2: { value: new Date(params.deadline).toLocaleString('zh-CN') },
        number3: { value: String(params.remainingVoters) },
        thing4: { value: '快去投票吧！' },
      }
    }))

    const { error } = await client
      .from('notification_queue')
      .insert(notifications.map(n => ({
        openid: n.openid,
        session_id: params.sessionId,
        template_id: n.templateId,
        page: n.page,
        data: n.data,
        status: 'pending',
        created_at: new Date().toISOString(),
      })))

    if (error) {
      console.error('[NotificationService] 保存提醒通知失败:', error)
      return false
    }

    return true
  }

  /**
   * 检测并处理到期的投票会话
   * 由定时任务调用
   */
  async checkAndProcessExpiredVotes(): Promise<{
    processed: number
    errors: string[]
  }> {
    const client = this.getClient()
    const errors: string[] = []
    let processed = 0

    // 查询已到期但未处理的投票会话
    const { data: expiredSessions, error: queryError } = await client
      .from('vote_sessions')
      .select('*')
      .lte('vote_deadline', new Date().toISOString())
      .eq('notification_sent', false)

    if (queryError) {
      console.error('[NotificationService] 查询过期投票失败:', queryError)
      return { processed: 0, errors: [queryError.message] }
    }

    if (!expiredSessions || expiredSessions.length === 0) {
      return { processed: 0, errors: [] }
    }

    for (const session of expiredSessions) {
      try {
        // 获取投票结果
        const { data: votes } = await client
          .from('vote_records')
          .select('inspiration_id, inspiration_title, vote_value')
          .eq('session_id', session.id)

        // 统计结果
        const voteStats = new Map<string, { title: string; votes: number }>()
        for (const vote of votes || []) {
          if (vote.vote_value === 1) {
            const existing = voteStats.get(vote.inspiration_id)
            voteStats.set(vote.inspiration_id, {
              title: vote.inspiration_title,
              votes: (existing?.votes || 0) + 1
            })
          }
        }

        const results = Array.from(voteStats.values())
          .sort((a, b) => b.votes - a.votes)
          .map(r => ({ name: r.title, votes: r.votes }))

        // 获取最高票
        const winner = results.length > 0 ? results[0].name : undefined

        // 发送通知
        await this.sendVoteResultNotification({
          sessionId: session.id,
          title: session.title,
          results,
          winner
        })

        // 标记已发送
        await client
          .from('vote_sessions')
          .update({ notification_sent: true })
          .eq('id', session.id)

        processed++
        console.log(`[NotificationService] 已处理投票通知: ${session.title}`)
      } catch (e: any) {
        errors.push(`${session.id}: ${e.message}`)
        console.error(`[NotificationService] 处理投票 ${session.id} 失败:`, e)
      }
    }

    return { processed, errors }
  }

  /**
   * 检测是否所有人都已投票
   */
  async checkAllVoted(sessionId: string, invitedCount: number): Promise<boolean> {
    const client = this.getClient()
    
    // 获取已投票人数
    const { count, error } = await client
      .from('vote_records')
      .select('voter_openid', { count: 'exact', head: true })
      .eq('session_id', sessionId)

    if (error) {
      console.error('[NotificationService] 查询投票人数失败:', error)
      return false
    }

    // 如果所有受邀人都投了票，触发通知
    if (count !== null && count >= invitedCount) {
      const session = await this.getSessionInfo(sessionId)
      if (session) {
        const votes = await this.getVoteResults(sessionId)
        const winner = votes.length > 0 ? votes[0].name : undefined
        
        await this.sendVoteResultNotification({
          sessionId,
          title: session.title,
          results: votes,
          winner
        })

        // 标记已发送
        await client
          .from('vote_sessions')
          .update({ notification_sent: true })
          .eq('id', sessionId)

        return true
      }
    }

    return false
  }

  private async getSessionInfo(sessionId: string) {
    const client = this.getClient()
    const { data } = await client
      .from('vote_sessions')
      .select('title')
      .eq('id', sessionId)
      .maybeSingle()
    return data
  }

  private async getVoteResults(sessionId: string) {
    const client = this.getClient()
    const { data: votes } = await client
      .from('vote_records')
      .select('inspiration_id, inspiration_title, vote_value')
      .eq('session_id', sessionId)

    const voteStats = new Map<string, { title: string; votes: number }>()
    for (const vote of votes || []) {
      if (vote.vote_value === 1) {
        const existing = voteStats.get(vote.inspiration_id)
        voteStats.set(vote.inspiration_id, {
          title: vote.inspiration_title,
          votes: (existing?.votes || 0) + 1
        })
      }
    }

    return Array.from(voteStats.values())
      .sort((a, b) => b.votes - a.votes)
      .map(r => ({ name: r.title, votes: r.votes }))
  }
}
