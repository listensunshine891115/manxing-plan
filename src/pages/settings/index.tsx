import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { 
  QrCode, LogOut, User, Check, ChevronRight, Copy, Link2
} from 'lucide-react-taro'
import { Network } from '@/network'

export default function Settings() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [showPasteDialog, setShowPasteDialog] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [pasting, setPasting] = useState(false)

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

  // 粘贴链接收录
  const handlePasteLink = async () => {
    if (!linkInput.trim()) {
      Taro.showToast({ title: '请输入链接', icon: 'none' })
      return
    }

    if (!linkInput.includes('http')) {
      Taro.showToast({ title: '请输入有效的链接', icon: 'none' })
      return
    }

    setPasting(true)
    try {
      const res = await Network.request({
        url: '/api/trip/add-inspiration',
        method: 'POST',
        data: {
          userId: userInfo?.id,
          url: linkInput.trim()
        }
      })
      
      if (res.data?.success) {
        Taro.showToast({ title: '收录成功', icon: 'success' })
        setLinkInput('')
        setShowPasteDialog(false)
      } else {
        Taro.showToast({ title: res.data?.message || '收录失败', icon: 'none' })
      }
    } catch (error) {
      console.error('收录失败:', error)
      Taro.showToast({ title: '收录失败', icon: 'none' })
    } finally {
      setPasting(false)
    }
  }

  // 粘贴剪贴板
  const handlePasteFromClipboard = async () => {
    try {
      const res = await Taro.getClipboardData()
      if (res.data) {
        setLinkInput(res.data)
        Taro.showToast({ title: '已粘贴', icon: 'success' })
      } else {
        Taro.showToast({ title: '剪贴板为空', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '粘贴失败', icon: 'none' })
    }
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
        <Text className="block text-xs text-gray-500 uppercase mb-2 px-1">灵感收录</Text>
        <Card>
          <View className="divide-y divide-gray-100">
            {/* 粘贴链接 */}
            <View 
              className="p-4 flex items-center justify-between"
              onClick={() => setShowPasteDialog(true)}
            >
              <View className="flex items-center gap-3">
                <View className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Link2 size={18} color="#10b981" />
                </View>
                <Text className="block text-sm text-gray-900">粘贴链接</Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </View>
            <View 
              className="p-4 flex items-center justify-between"
              onClick={goToBindGuide}
            >
              <View className="flex items-center gap-3">
                <View className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <QrCode size={18} color="#3b82f6" />
                </View>
                <Text className="block text-sm text-gray-900">绑定公众号</Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </View>
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

      {/* 粘贴链接弹窗 */}
      <Dialog open={showPasteDialog} onOpenChange={(open) => !open && setShowPasteDialog(false)}>
        <View className="p-6">
          <View className="text-center mb-4">
            <View className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Link2 size={24} color="#10b981" />
            </View>
            <Text className="block text-lg font-medium text-gray-900">粘贴链接</Text>
            <Text className="block text-sm text-gray-500 mt-1">
              粘贴旅行相关的分享链接即可收录
            </Text>
          </View>

          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <View className="mb-3">
              <Input 
                className="w-full bg-white"
                placeholder="粘贴或输入分享链接..."
                value={linkInput}
                onInput={(e: any) => setLinkInput(e.target.value)}
              />
            </View>
            <View className="flex gap-2">
              <Button 
                className="flex-1 bg-white border border-gray-200"
                onClick={handlePasteFromClipboard}
              >
                <Copy size={14} color="#3b82f6" />
                <Text className="text-blue-600 ml-1">粘贴</Text>
              </Button>
              <Button 
                className="flex-1 bg-blue-500"
                onClick={handlePasteLink}
                disabled={pasting}
              >
                <Text className="text-white">{pasting ? '收录中...' : '收录'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Dialog>
    </View>
  )
}
