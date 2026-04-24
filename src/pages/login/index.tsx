import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Copy, User, Sparkles, MapPin } from 'lucide-react-taro'
import './login.css'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [userCode, setUserCode] = useState('')
  const [bindCode, setBindCode] = useState('')
  const [userInfo, setUserInfo] = useState<{
    id: string
    nickname: string
    user_code: string
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
        setUserCode(res.data.user_code)
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
        Taro.showToast({ title: '登录失败', icon: 'none' })
        return
      }

      // 模拟本地生成用户码（实际项目中由后端返回）
      const mockUser = {
        id: 'user_' + Date.now(),
        nickname: '旅行者',
        user_code: generateUserCode(),
        inspiration_count: 0
      }

      // 2. 保存用户信息
      await Taro.setStorage({ key: 'userInfo', data: mockUser })
      setUserInfo(mockUser)
      setUserCode(mockUser.user_code)

      Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '登录失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 模拟生成用户码
  const generateUserCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // 复制用户码
  const handleCopyCode = () => {
    Taro.setClipboardData({
      data: userCode,
      success: () => {
        Taro.showToast({ title: '已复制用户码', icon: 'success' })
      }
    })
  }

  // 已有用户码，手动输入绑定
  const handleBindCode = () => {
    if (!bindCode || bindCode.length < 6) {
      Taro.showToast({ title: '请输入正确的用户码', icon: 'none' })
      return
    }
    Taro.showToast({ title: '绑定功能开发中', icon: 'none' })
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
              <View className="flex items-center gap-3">
                <View className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User size={24} color="#3b82f6" />
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
            </CardHeader>
            <CardContent className="space-y-4">
              <View className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
                <Text className="block text-xs text-gray-500 mb-2">
                  您的专属用户码
                </Text>
                <View className="flex items-center justify-between">
                  <Text className="block text-2xl font-mono font-bold text-blue-600 tracking-widest">
                    {userInfo.user_code}
                  </Text>
                  <Button
                    className="bg-white border border-blue-200"
                    onClick={handleCopyCode}
                  >
                    <Copy size={14} color="#3b82f6" />
                    <Text className="ml-1 text-blue-600">复制</Text>
                  </Button>
                </View>
              </View>

              <View className="bg-amber-50 rounded-xl p-4">
                <Text className="block text-sm text-amber-800 font-medium mb-2">
                  如何使用？
                </Text>
                <View className="text-sm text-amber-700 space-y-1">
                  <Text className="block">1. 复制上方的用户码</Text>
                  <Text className="block">2. 将用户码发送给旅行助手账号</Text>
                  <Text className="block">3. 之后发送的链接会自动收录到您的灵感池</Text>
                </View>
              </View>

              <Button
                className="w-full bg-blue-500"
                onClick={() => Taro.switchTab({ url: '/pages/index/index' })}
              >
                <Text className="text-white">进入灵感库</Text>
              </Button>
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
                  登录后获取您的专属用户码，开始收集旅行灵感
                </Text>
              </View>

              <View className="space-y-3">
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

                <View className="relative py-4">
                  <View className="absolute inset-0 flex items-center">
                    <View className="w-full border-t border-gray-200" />
                  </View>
                  <View className="relative flex justify-center">
                    <Badge variant="secondary" className="bg-white px-3">
                      <Text className="text-gray-500 text-xs">或</Text>
                    </Badge>
                  </View>
                </View>

                <View className="bg-gray-50 rounded-xl p-4">
                  <Text className="block text-sm text-gray-700 font-medium mb-3">
                    已有用户码？直接绑定
                  </Text>
                  <View className="flex gap-2">
                    <View className="flex-1">
                      <Input
                        className="w-full"
                        placeholder="输入用户码"
                        maxlength={8}
                        value={bindCode}
                        onInput={(e: any) => setBindCode(e.target.value)}
                      />
                    </View>
                    <Button
                      className="bg-blue-500"
                      onClick={handleBindCode}
                    >
                      <Text className="text-white">绑定</Text>
                    </Button>
                  </View>
                </View>
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
