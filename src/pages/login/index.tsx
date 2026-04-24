import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Sparkles } from 'lucide-react-taro'
import { Network } from '@/network'
import './login.css'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [userInfo, setUserInfo] = useState<{
    id: string
    openid: string
    nickname: string
    avatar: string
    inspiration_count: number
  } | null>(null)

  useEffect(() => {
    checkLogin()
  }, [])

  // 检查登录状态
  const checkLogin = async () => {
    try {
      const res = await Taro.getStorage({ key: 'userInfo' })
      if (res.data) {
        setUserInfo(res.data)
      }
    } catch {
      // 未登录
    }
  }

  // 微信登录
  const handleLogin = async () => {
    setLoading(true)
    try {
      // 1. 获取微信登录凭证
      const loginRes = await Taro.login()
      if (!loginRes.code) {
        Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
        return
      }

      // 2. 调用后端接口获取/创建用户
      let userId = ''
      try {
        const res = await Network.request({
          url: '/api/message/user',
          method: 'GET',
          data: { openid: loginRes.code } // 实际项目中后端会通过 code 换取 openid
        })
        console.log('[GET] /api/message/user - Response:', JSON.stringify(res.data))
        if (res.data?.data) {
          userId = res.data.data.id
        }
      } catch (e) {
        console.error('获取用户信息失败，使用本地模拟:', e)
      }

      // 3. 如果后端未返回用户，手动创建本地用户
      if (!userId) {
        userId = 'user_' + Date.now()
      }

      // 4. 保存用户信息
      const user = {
        id: userId,
        openid: loginRes.code,
        nickname: '旅行者',
        avatar: '',
        inspiration_count: 0
      }

      await Taro.setStorage({ key: 'userInfo', data: user })
      setUserInfo(user)

      Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 退出登录
  const handleLogout = async () => {
    await Taro.removeStorage({ key: 'userInfo' })
    setUserInfo(null)
    Taro.showToast({ title: '已退出登录', icon: 'success' })
  }

  return (
    <View className="min-h-screen bg-gray-50 px-4 py-8">
      <View className="max-w-md mx-auto">
        {/* Logo */}
        <View className="text-center mb-8">
          <View className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4">
            <MapPin size={32} color="#fff" />
          </View>
          <Text className="block text-2xl font-bold text-gray-900">此刻与你漫行</Text>
          <Text className="block text-sm text-gray-500 mt-1">开启你的旅行灵感之旅</Text>
        </View>

        {userInfo ? (
          // 已登录状态
          <Card>
            <CardHeader>
              <View className="flex items-center justify-between">
                <View className="flex items-center gap-3">
                  <View className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <MapPin size={24} color="#3b82f6" />
                  </View>
                  <View>
                    <Text className="block text-lg font-medium text-gray-900">
                      {userInfo.nickname}
                    </Text>
                    <Badge variant="secondary" className="mt-1">
                      <Sparkles size={12} color="#3b82f6" />
                      <Text className="ml-1">{userInfo.inspiration_count} 个灵感</Text>
                    </Badge>
                  </View>
                </View>
              </View>
            </CardHeader>
            <CardContent className="space-y-4">
              <View className="bg-blue-50 rounded-xl p-4">
                <Text className="block text-sm text-blue-800 font-medium mb-2">
                  如何收集灵感？
                </Text>
                <View className="text-sm text-blue-700 space-y-1">
                  <Text className="block">1. 关注旅行助手公众号</Text>
                  <Text className="block">2. 发送旅行相关的分享链接</Text>
                  <Text className="block">3. 返回小程序查看已收录的灵感</Text>
                </View>
              </View>

              <View className="flex gap-3">
                <Button
                  className="flex-1 bg-blue-500"
                  onClick={() => Taro.switchTab({ url: '/pages/index/index' })}
                >
                  <Text className="text-white">进入灵感库</Text>
                </Button>
                <Button
                  className="flex-1 bg-white border border-gray-200"
                  onClick={handleLogout}
                >
                  <Text className="text-gray-700">退出登录</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        ) : (
          // 未登录状态
          <Card>
            <CardContent className="space-y-6 pt-6">
              <View className="text-center">
                <Text className="block text-lg font-medium text-gray-900 mb-2">
                  欢迎来到旅行灵感库
                </Text>
                <Text className="block text-sm text-gray-500">
                  登录后即可开始收集旅行灵感，规划完美行程
                </Text>
              </View>

              <View className="space-y-4">
                <View className="bg-gray-50 rounded-xl p-4">
                  <Text className="block text-sm text-gray-700 font-medium mb-3">
                    收集灵感的方式
                  </Text>
                  <View className="space-y-2">
                    <View className="flex items-start gap-3">
                      <View className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                        <Text className="text-white text-xs font-bold">1</Text>
                      </View>
                      <Text className="block text-sm text-gray-600">
                        关注公众号，发送旅行链接
                      </Text>
                    </View>
                    <View className="flex items-start gap-3">
                      <View className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                        <Text className="text-white text-xs font-bold">2</Text>
                      </View>
                      <Text className="block text-sm text-gray-600">
                        链接自动解析收录到灵感库
                      </Text>
                    </View>
                    <View className="flex items-start gap-3">
                      <View className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                        <Text className="text-white text-xs font-bold">3</Text>
                      </View>
                      <Text className="block text-sm text-gray-600">
                        在小程序勾选灵感，自动生成路线
                      </Text>
                    </View>
                  </View>
                </View>

                <Button
                  className="w-full bg-blue-500"
                  onClick={handleLogin}
                >
                  {loading ? (
                    <Text className="text-white">登录中...</Text>
                  ) : (
                    <Text className="text-white">微信一键登录</Text>
                  )}
                </Button>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 功能说明 */}
        <View className="mt-8 space-y-4">
          <Text className="block text-center text-sm text-gray-500 mb-4">
            核心功能
          </Text>
          <View className="grid grid-cols-2 gap-3">
            <View className="bg-white rounded-xl p-4 text-center">
              <View className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Sparkles size={20} color="#3b82f6" />
              </View>
              <Text className="block text-sm font-medium text-gray-900">收集灵感</Text>
              <Text className="block text-xs text-gray-500 mt-1">分享链接自动收录</Text>
            </View>
            <View className="bg-white rounded-xl p-4 text-center">
              <View className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <MapPin size={20} color="#22c55e" />
              </View>
              <Text className="block text-sm font-medium text-gray-900">生成路线</Text>
              <Text className="block text-xs text-gray-500 mt-1">一键智能规划行程</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
