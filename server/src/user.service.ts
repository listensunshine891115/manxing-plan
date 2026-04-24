import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

interface User {
  id: string
  openid: string  // 微信 openid，用于关联公众号消息
  nickname?: string
  avatar?: string
  create_time: string
}

@Injectable()
export class UserService {
  private get client() {
    return getSupabaseClient()
  }

  // 获取 supabase client（供其他服务使用）
  getSupabaseClient() {
    return this.client
  }

  // 创建或获取用户（通过 openid）
  async getOrCreateUser(openid: string, nickname?: string, avatar?: string): Promise<User> {
    // 查找已有用户
    const { data: existing } = await this.client
      .from('users')
      .select('*')
      .eq('openid', openid)
      .single()

    if (existing) {
      // 更新昵称和头像
      if (nickname || avatar) {
        const { data: updated } = await this.client
          .from('users')
          .update({ nickname, avatar })
          .eq('openid', openid)
          .select()
          .single()
        return updated
      }
      return existing
    }

    // 创建新用户
    const { data: newUser, error } = await this.client
      .from('users')
      .insert({
        openid,
        nickname: nickname || '旅行者',
        avatar: avatar || ''
      })
      .select()
      .single()

    if (error) {
      console.error('创建用户失败:', error)
      throw new Error('创建用户失败')
    }

    return newUser
  }

  // 通过 openid 获取用户
  async getUserByOpenid(openid: string): Promise<User | null> {
    const { data } = await this.client
      .from('users')
      .select('*')
      .eq('openid', openid)
      .single()
    return data || null
  }

  // 更新用户信息
  async updateUser(openid: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await this.client
      .from('users')
      .update(updates)
      .eq('openid', openid)
      .select()
      .single()

    if (error) {
      throw new Error('更新用户失败')
    }
    return data
  }

  // 获取用户灵感数量
  async getUserInspirationCount(userId: string): Promise<number> {
    const { count } = await this.client
      .from('inspirations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    return count || 0
  }
}
