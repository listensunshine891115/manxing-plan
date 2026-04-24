import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

interface User {
  id: string
  openid?: string
  nickname?: string
  avatar?: string
  user_code: string  // 用户码，用于消息关联
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
  async getOrCreateUser(openid: string, nickname?: string, avatar?: string) {
    // 先查询是否存在
    const { data: existing } = await this.client
      .from('users')
      .select('*')
      .eq('openid', openid)
      .maybeSingle()

    if (existing) {
      // 更新昵称和头像
      if (nickname || avatar) {
        await this.client
          .from('users')
          .update({ nickname, avatar })
          .eq('id', existing.id)
      }
      return existing
    }

    // 创建新用户，生成用户码
    const userCode = this.generateUserCode()
    const { data, error } = await this.client
      .from('users')
      .insert({
        openid,
        nickname,
        avatar,
        user_code: userCode
      })
      .select()
      .single()

    if (error) throw new Error(`创建用户失败: ${error.message}`)
    return data
  }

  // 通过用户码获取用户
  async getUserByCode(userCode: string) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('user_code', userCode)
      .maybeSingle()

    if (error) throw new Error(`查询用户失败: ${error.message}`)
    return data
  }

  // 通过 openid 获取用户
  async getUserByOpenid(openid: string) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('openid', openid)
      .maybeSingle()

    if (error) throw new Error(`查询用户失败: ${error.message}`)
    return data
  }

  // 生成唯一用户码（6位字母数字）
  private generateUserCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // 验证用户码是否存在
  async validateUserCode(code: string): Promise<boolean> {
    const user = await this.getUserByCode(code)
    return !!user
  }

  // 获取用户灵感数量
  async getUserInspirationCount(userId: string): Promise<number> {
    const { count, error } = await this.client
      .from('inspirations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) return 0
    return count || 0
  }
}
