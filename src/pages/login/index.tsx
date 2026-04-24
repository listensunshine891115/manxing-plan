import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Sparkles, Copy, Check, MessageCircle, LogOut, ChevronRight, User } from 'lucide-react-taro'
import './login.css'

export default function Profile() {
  const [userInfo, setUserInfo] = useState<{
    id: string
    openid: string
    nickname: string
    user_code: string
    wx_openid: string
    inspiration_count: number
  } | null>(null)
  
  const [codeCopied, setCodeCopied] = useState(false)

  useEffect(() => {
    loadUserInfo()
  }, [])

  // 加载用户信息
  const loadUserInfo = async () => {
    try {
      const res = await Taro.getStorage({ key: 'userInfo' })
      if (res.data) {
        setUserInfo(res.data)
      }
    } catch {
      // 未登录
    }
  }

  // 复制用户码
  const handleCopyCode = () => {
    if (!userInfo?.user_code) return
    Taro.setClipboardData({
      data: userInfo.user_code,
      success: () => {
        setCodeCopied(true)
        Taro.showToast({ title: '已复制用户码', icon: 'success' })
        setTimeout(() => setCodeCopied(false), 2000)
      }
    })
  }

  // 退出登录
  const handleLogout = async () => {
    await Taro.removeStorage({ key: 'userInfo' })
    setUserInfo(null)
    Taro.showToast({ title: '已退出登录', icon: 'success' })
  }

  // 未登录状态
  if (!userInfo) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <View className="text-center px-8">
          <View className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <User size={32} color="#fff" />
          </View>
          <Text className="block text-xl font-semibold text-gray-900 mb-2">未登录</Text>
          <Text className="block text-sm text-gray-500 mb-6">请先在灵感页面登录</Text>
          <Button 
            className="bg-blue-500 px-6"
            onClick={() => Taro.switchTab({ url: '/pages/index/index' })}
          >
            <Text className="text-white">去登录</Text>
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部用户卡片 */}
      <View className="bg-gradient-to-br from-blue-500 to-blue-600 px-4 pt-12 pb-8">
        <View className="flex items-center gap-4">
          <View className="w-14 h-14 bg-white rounded-full flex items-center justify-center">
            <User size={28} color="#3b82f6" />
          </View>
          <View className="flex-1">
            <Text className="block text-xl font-semibold text-white">{userInfo.nickname}</Text>
            <Badge className="mt-1 bg-white bg-opacity-20 text-white border-0">
              <Sparkles size={12} color="#fff" />
              <Text className="ml-1">{userInfo.inspiration_count} 个灵感</Text>
            </Badge>
          </View>
        </View>
      </View>

      {/* 用户码卡片 */}
      <View className="px-4 -mt-4">
        <Card>
          <CardContent className="p-4">
            <View className="flex items-center justify-between">
              <View>
                <Text className="block text-xs text-gray-500 mb-1">您的专属用户码</Text>
                <Text className="block text-2xl font-mono font-bold text-blue-600 tracking-widest">
                  {userInfo.user_code}
                </Text>
              </View>
              <Button 
                className="bg-blue-50 border border-blue-200"
                onClick={handleCopyCode}
              >
                {codeCopied ? (
                  <>
                    <Check size={14} color="#22c55e" />
                    <Text className="ml-1 text-green-600">已复制</Text>
                  </>
                ) : (
                  <>
                    <Copy size={14} color="#3b82f6" />
                    <Text className="ml-1 text-blue-600">复制</Text>
                  </>
                )}
              </Button>
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 绑定状态 */}
      <View className="px-4 mt-4">
        {userInfo.wx_openid ? (
          <Card>
            <CardContent className="p-4">
              <View className="flex items-center gap-3">
                <View className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Check size={20} color="#22c55e" />
                </View>
                <View className="flex-1">
                  <Text className="block text-sm font-medium text-gray-900">公众号已绑定</Text>
                  <Text className="block text-xs text-gray-500 mt-1">
                    您可以直接在公众号发送链接进行收录
                  </Text>
                </View>
              </View>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <View className="flex items-start gap-3">
                <View className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                  <MessageCircle size={20} color="#f59e0b" />
                </View>
                <View className="flex-1">
                  <Text className="block text-sm font-medium text-gray-900 mb-1">绑定公众号（推荐）</Text>
                  <View className="text-xs text-gray-500 space-y-1">
                    <Text className="block">1. 关注「旅行助手」公众号</Text>
                    <Text className="block">2. 发送「绑定#{userInfo.user_code}」</Text>
                    <Text className="block">3. 之后发链接自动收录到灵感库</Text>
                  </View>
                </View>
              </View>
            </CardContent>
          </Card>
        )}
      </View>

      {/* 功能菜单 */}
      <View className="px-4 mt-4">
        <Card>
          <View className="divide-y divide-gray-100">
            <View className="flex items-center justify-between p-4">
              <View className="flex items-center gap-3">
                <Sparkles size={20} color="#3b82f6" />
                <Text className="block text-sm text-gray-900">我的灵感</Text>
              </View>
              <View className="flex items-center">
                <Text className="block text-sm text-gray-400 mr-2">{userInfo.inspiration_count} 个</Text>
                <ChevronRight size={16} color="#9ca3af" />
              </View>
            </View>
            <View className="flex items-center justify-between p-4">
              <View className="flex items-center gap-3">
                <MapPin size={20} color="#10b981" />
                <Text className="block text-sm text-gray-900">出行记录</Text>
              </View>
              <ChevronRight size={16} color="#9ca3af" />
            </View>
          </View>
        </Card>
      </View>

      {/* 退出登录 */}
      <View className="px-4 mt-6">
        <Button 
          className="w-full bg-white border border-red-200"
          onClick={handleLogout}
        >
          <LogOut size={16} color="#ef4444" />
          <Text className="ml-2 text-red-500">退出登录</Text>
        </Button>
      </View>
    </View>
  )
}
