import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  QrCode, LogOut, User, Check, ChevronRight, Copy
} from 'lucide-react-taro'

export default function Settings() {
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    const res = Taro.getStorageSync('userInfo')
    if (res) {
      setUserInfo(res)
    }
  }, [])

  const handleCopyCode = () => {
    if (!userInfo?.user_code) return
    Taro.setClipboardData({
      data: userInfo.user_code,
      success: () => {
        Taro.showToast({ title: '已复制', icon: 'success' })
      }
    })
  }

  const goToBindGuide = () => {
    Taro.navigateTo({ url: '/pages/bind-guide/index' })
  }

  const handleLogout = async () => {
    await Taro.removeStorage({ key: 'userInfo' })
    Taro.showToast({ title: '已退出', icon: 'success' })
    setTimeout(() => {
      Taro.reLaunch({ url: '/pages/index/index' })
    }, 500)
  }

  if (!userInfo) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Text className="block text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-safe">
      {/* 用户信息 */}
      <View className="bg-white px-4 py-6 mb-4">
        <View className="flex items-center gap-4">
          <View className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={32} color="#3b82f6" />
          </View>
          <View className="flex-1">
            <Text className="block text-lg font-medium text-gray-900">{userInfo.nickname}</Text>
            <View className="flex items-center gap-2 mt-1">
              <Text className="block text-sm text-gray-500">用户码：</Text>
              <Badge variant="outline" className="font-mono font-bold">
                {userInfo.user_code}
              </Badge>
              <Button size="sm" variant="ghost" onClick={handleCopyCode}>
                <Copy size={12} color="#3b82f6" />
              </Button>
            </View>
          </View>
        </View>
      </View>

      {/* 绑定状态 */}
      <View className="px-4 mb-4">
        <Card>
          <View 
            className="p-4 flex items-center justify-between"
            onClick={goToBindGuide}
          >
            <View className="flex items-center gap-3">
              <View 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: userInfo.wx_openid ? '#dcfce7' : '#fef3c7' }}
              >
                {userInfo.wx_openid ? (
                  <Check size={20} color="#16a34a" />
                ) : (
                  <QrCode size={20} color="#d97706" />
                )}
              </View>
              <View>
                <Text className="block text-sm font-medium text-gray-900">公众号绑定</Text>
                <Text className="block text-xs text-gray-500 mt-1">
                  {userInfo.wx_openid ? '已绑定公众号' : '未绑定'}
                </Text>
              </View>
            </View>
            <View className="flex items-center">
              <Badge 
                className="mr-2"
                style={{ 
                  backgroundColor: userInfo.wx_openid ? '#dcfce7' : '#fef3c7',
                  color: userInfo.wx_openid ? '#16a34a' : '#d97706'
                }}
              >
                {userInfo.wx_openid ? '已绑定' : '未绑定'}
              </Badge>
              <ChevronRight size={18} color="#9ca3af" />
            </View>
          </View>
        </Card>
      </View>

      {/* 功能列表 */}
      <View className="px-4 mb-4">
        <Text className="block text-xs text-gray-500 uppercase mb-2 px-1">其他设置</Text>
        <Card>
          <View className="divide-y divide-gray-100">
            <View 
              className="p-4 flex items-center justify-between"
              onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}
            >
              <View className="flex items-center gap-3">
                <Text className="text-lg">🎨</Text>
                <Text className="block text-sm text-gray-900">主题设置</Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </View>
            <View 
              className="p-4 flex items-center justify-between"
              onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}
            >
              <View className="flex items-center gap-3">
                <Text className="text-lg">🔔</Text>
                <Text className="block text-sm text-gray-900">消息通知</Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </View>
            <View 
              className="p-4 flex items-center justify-between"
              onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}
            >
              <View className="flex items-center gap-3">
                <Text className="text-lg">📖</Text>
                <Text className="block text-sm text-gray-900">使用帮助</Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </View>
          </View>
        </Card>
      </View>

      {/* 关于 */}
      <View className="px-4 mb-6">
        <Card>
          <View 
            className="p-4 flex items-center justify-between"
            onClick={() => Taro.showToast({ title: '功能开发中', icon: 'none' })}
          >
            <View className="flex items-center gap-3">
              <Text className="text-lg">ℹ️</Text>
              <Text className="block text-sm text-gray-900">关于我们</Text>
            </View>
            <ChevronRight size={18} color="#9ca3af" />
          </View>
        </Card>
      </View>

      {/* 退出登录 */}
      <View className="px-4 pb-8">
        <Button 
          className="w-full bg-white border border-red-200 hover:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut size={16} color="#ef4444" />
          <Text className="text-red-500 ml-2">退出登录</Text>
        </Button>
      </View>
    </View>
  )
}
