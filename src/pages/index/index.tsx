import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Sparkles, MapPin, Calendar, Target, ChevronRight, MessageCircle, Copy, Check } from 'lucide-react-taro'
import { Inspiration } from '@/types'
import { Network } from '@/network'
import './index.css'

const typeConfig = {
  spot: { color: '#3B82F6', label: '景点', icon: '🏛️' },
  food: { color: '#F59E0B', label: '美食', icon: '🍜' },
  show: { color: '#8B5CF6', label: '演出', icon: '🎭' },
  hotel: { color: '#10B981', label: '住宿', icon: '🏨' }
}

const sourceConfig = {
  xiaohongshu: { color: '#FF2442', label: '小红书' },
  dazhong: { color: '#FF6600', label: '大众点评' },
  damai: { color: '#00B51D', label: '大麦' },
  other: { color: '#64748B', label: '其他' }
}

export default function Index() {
  const [inspirations, setInspirations] = useState<Inspiration[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  // 用户状态
  const [userInfo, setUserInfo] = useState<{
    id: string
    openid: string
    nickname: string
    user_code: string
    wx_openid: string
  } | null>(null)
  
  // 登录弹窗
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  
  // 绑定引导弹窗
  const [showBindGuide, setShowBindGuide] = useState(false)
  
  // 用户码复制状态
  const [codeCopied, setCodeCopied] = useState(false)

  // 检查登录状态
  const checkLogin = async () => {
    try {
      const res = await Taro.getStorage({ key: 'userInfo' })
      if (res.data) {
        setUserInfo(res.data)
        // 检查是否首次进入（未显示过绑定引导）
        const bindGuideShown = await Taro.getStorage({ key: 'bindGuideShown' })
        if (!bindGuideShown.data && !res.data.wx_openid) {
          setShowBindGuide(true)
        }
        return res.data
      }
    } catch {
      // 未登录
    }
    return null
  }

  // 加载灵感列表
  const fetchInspirations = async () => {
    const user = await checkLogin()
    
    // 如果没有用户ID，生成临时ID（模拟）
    const userId = user?.id || 'guest_' + Date.now()

    try {
      const res = await Network.request({
        url: '/api/trip/inspirations',
        data: { userId }
      })
      console.log('[GET] /api/trip/inspirations - Response:', JSON.stringify(res.data))
      if (res.data?.data) {
        setInspirations(res.data.data)
      }
    } catch (error) {
      console.error('获取灵感失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInspirations()
  }, [])

  // 微信登录
  const handleLogin = async () => {
    try {
      const loginRes = await Taro.login()
      if (!loginRes.code) {
        Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
        return
      }

      // 模拟生成用户信息
      const user = {
        id: 'user_' + Date.now(),
        openid: loginRes.code,
        nickname: '旅行者',
        user_code: generateUserCode(),
        wx_openid: ''
      }

      await Taro.setStorage({ key: 'userInfo', data: user })
      setUserInfo(user)
      setShowLoginDialog(false)
      
      // 显示绑定引导
      setShowBindGuide(true)
      
      Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '登录失败', icon: 'none' })
    }
  }

  // 生成用户码
  const generateUserCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
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

  // 关闭绑定引导
  const handleCloseBindGuide = async () => {
    setShowBindGuide(false)
    await Taro.setStorage({ key: 'bindGuideShown', data: true })
  }

  // 切换选中状态
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  // 全选/取消全选
  const toggleAll = (type: 'spot' | 'food' | 'show' | 'hotel') => {
    const typeIds = inspirations.filter(i => i.type === type).map(i => i.id)
    const allSelected = typeIds.every(id => selectedIds.includes(id))
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !typeIds.includes(id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...typeIds])])
    }
  }

  // 开始规划
  const handleStartPlan = () => {
    if (selectedIds.length === 0) {
      setSelectedIds(inspirations.map(i => i.id))
    }
    window.location.href = '/pages/generate/index?selected=' + selectedIds.join(',')
  }

  // 按类型分组
  const groupedInspirations = {
    spot: inspirations.filter(i => i.type === 'spot'),
    food: inspirations.filter(i => i.type === 'food'),
    show: inspirations.filter(i => i.type === 'show'),
    hotel: inspirations.filter(i => i.type === 'hotel')
  }

  // 未登录状态
  if (!userInfo) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <View className="text-center px-8">
          <View className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MapPin size={32} color="#fff" />
          </View>
          <Text className="block text-xl font-semibold text-foreground mb-2">此刻与你漫行</Text>
          <Text className="block text-sm text-muted-foreground mb-8">登录后获取您的专属用户码</Text>
          <Button className="bg-blue-500 px-8" onClick={() => setShowLoginDialog(true)}>
            <Text className="text-white">微信一键登录</Text>
          </Button>
        </View>

        {/* 登录弹窗 */}
        <Dialog open={showLoginDialog} onOpenChange={(open) => setShowLoginDialog(open)}>
          <View className="p-6">
            <Text className="block text-lg font-medium text-center mb-4">微信登录</Text>
            <Text className="block text-sm text-gray-500 text-center mb-6">
              登录后将获取您的专属用户码，用于绑定公众号
            </Text>
            <Button className="w-full bg-blue-500" onClick={handleLogin}>
              <Text className="text-white">确认登录</Text>
            </Button>
          </View>
        </Dialog>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-24">
      {/* 顶部用户信息栏 */}
      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <View className="flex items-center justify-between">
          {/* 左侧：品牌 + 用户码 */}
          <View className="flex items-center gap-3">
            <Sparkles size={20} color="#3b82f6" />
            <View className="flex items-center gap-2">
              <Text className="text-sm font-medium text-gray-900">{userInfo.nickname}</Text>
              <Badge variant="outline" className="text-xs font-mono">
                {userInfo.user_code}
              </Badge>
            </View>
          </View>
          
          {/* 右侧：绑定状态 */}
          <View 
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs"
            style={{ 
              backgroundColor: userInfo.wx_openid ? '#dcfce7' : '#fef3c7',
              color: userInfo.wx_openid ? '#16a34a' : '#d97706'
            }}
            onClick={() => !userInfo.wx_openid && setShowBindGuide(true)}
          >
            {userInfo.wx_openid ? (
              <>
                <Check size={12} color="#22c55e" />
                <Text>已绑定</Text>
              </>
            ) : (
              <>
                <MessageCircle size={12} color="#f59e0b" />
                <Text>未绑定</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* 快捷入口 */}
      <View className="px-4 py-4">
        <View className="flex gap-3">
          <View 
            className="flex-1 bg-white rounded-xl p-4 flex items-center gap-3"
            onClick={() => window.location.href = '/pages/generate/index'}
          >
            <View className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Calendar size={20} color="#3b82f6" />
            </View>
            <View>
              <Text className="block text-sm font-medium text-gray-900">出行设置</Text>
              <Text className="block text-xs text-gray-400">设置行程信息</Text>
            </View>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 flex items-center gap-3">
            <View className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <Target size={20} color="#f59e0b" />
            </View>
            <View>
              <Text className="block text-sm font-medium text-gray-900">灵感管理</Text>
              <Text className="block text-xs text-gray-400">编辑收藏夹</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 提示卡片 */}
      <View className="px-4 mb-4">
        <View className="bg-green-50 rounded-xl px-4 py-3 flex items-start gap-3">
          <MessageCircle size={16} color="#10b981" className="shrink-0 mt-1" />
          <View className="flex-1">
            <Text className="block text-sm text-green-800">
              发送分享链接给「旅行助手」公众号即可自动收录
            </Text>
            {userInfo.wx_openid && (
              <Text className="block text-xs text-green-600 mt-1">
                已绑定公众号，发送链接试试吧
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* 灵感分类列表 */}
      {(['spot', 'food', 'show', 'hotel'] as const).map(type => {
        const items = groupedInspirations[type]
        if (items.length === 0) return null
        
        const typeInfo = typeConfig[type]
        const allSelected = items.every(i => selectedIds.includes(i.id))
        
        return (
          <View key={type} className="mb-4">
            {/* 类型标题 */}
            <View className="px-4 flex items-center justify-between mb-2">
              <View className="flex items-center">
                <Text className="block mr-2">{typeInfo.icon}</Text>
                <Text className="block text-base font-medium text-foreground">{typeInfo.label}</Text>
                <Badge variant="secondary" className="ml-2 text-xs">{items.length}</Badge>
              </View>
              <View 
                className="flex items-center text-sm text-blue-500"
                onClick={() => toggleAll(type)}
              >
                <Text>{allSelected ? '取消全选' : '全选'}</Text>
              </View>
            </View>

            {/* 灵感卡片列表 */}
            <View className="px-4 space-y-3">
              {items.map(item => (
                <Card key={item.id} className="overflow-hidden">
                  <View 
                    className={`p-4 flex items-start gap-3 ${selectedIds.includes(item.id) ? 'bg-blue-50' : 'bg-white'}`}
                    onClick={() => toggleSelect(item.id)}
                  >
                    <Checkbox 
                      checked={selectedIds.includes(item.id)} 
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                    <View className="flex-1">
                      <Text className="block text-sm font-medium text-foreground mb-1">
                        {item.title}
                      </Text>
                      <View className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className="text-xs"
                          style={{ 
                            backgroundColor: sourceConfig[item.source as keyof typeof sourceConfig]?.color + '20',
                            color: sourceConfig[item.source as keyof typeof sourceConfig]?.color || '#64748B'
                          }}
                        >
                          {sourceConfig[item.source as keyof typeof sourceConfig]?.label || '其他'}
                        </Badge>
                        <Text className="block text-xs text-gray-400">
                          {typeof item.createTime === 'string' 
                            ? item.createTime.slice(0, 10) 
                            : item.createTime 
                              ? new Date(item.createTime as number).toLocaleDateString() 
                              : ''}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={16} color="#9ca3af" />
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )
      })}

      {/* 空状态 */}
      {inspirations.length === 0 && !loading && (
        <View className="flex flex-col items-center justify-center py-16">
          <View className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Sparkles size={32} color="#9ca3af" />
          </View>
          <Text className="block text-base font-medium text-gray-900 mb-2">暂无灵感</Text>
          <Text className="block text-sm text-gray-400 text-center px-8">
            关注公众号并发送分享链接{'\n'}即可自动收录到灵感库
          </Text>
        </View>
      )}

      {/* 底部规划按钮 */}
      <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 pb-8">
        <View className="flex items-center gap-3">
          <View className="flex-1">
            <Text className="block text-sm text-gray-500">
              已选 <Text className="text-blue-500 font-medium">{selectedIds.length}</Text> 项
            </Text>
          </View>
          <Button 
            className="bg-blue-500 px-6"
            onClick={handleStartPlan}
          >
            <Text className="text-white">开始规划</Text>
            <ChevronRight size={16} color="#fff" className="ml-1" />
          </Button>
        </View>
      </View>

      {/* 绑定引导弹窗 */}
      <Dialog open={showBindGuide} onOpenChange={(open) => !open && handleCloseBindGuide()}>
        <View className="p-6">
          <View className="text-center mb-6">
            <View className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} color="#3b82f6" />
            </View>
            <Text className="block text-lg font-medium text-gray-900 mb-2">
              绑定公众号（推荐）
            </Text>
            <Text className="block text-sm text-gray-500">
              绑定后发送旅行链接给公众号{'\n'}即可自动收录到灵感库
            </Text>
          </View>

          {/* 用户码 */}
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <Text className="block text-xs text-gray-500 mb-2 text-center">您的专属用户码</Text>
            <View className="flex items-center justify-center gap-3">
              <Text className="block text-2xl font-mono font-bold text-blue-600 tracking-widest">
                {userInfo.user_code}
              </Text>
              <Button 
                size="sm"
                className="bg-white border border-gray-200"
                onClick={handleCopyCode}
              >
                {codeCopied ? (
                  <>
                    <Check size={12} color="#22c55e" />
                    <Text className="ml-1 text-green-600">已复制</Text>
                  </>
                ) : (
                  <>
                    <Copy size={12} color="#3b82f6" />
                    <Text className="ml-1 text-blue-600">复制</Text>
                  </>
                )}
              </Button>
            </View>
          </View>

          {/* 绑定步骤 */}
          <View className="space-y-3 mb-6">
            <View className="flex items-start gap-3">
              <View className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                <Text className="text-white text-xs font-bold">1</Text>
              </View>
              <Text className="block text-sm text-gray-700">打开微信，搜索「旅行助手」公众号并关注</Text>
            </View>
            <View className="flex items-start gap-3">
              <View className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                <Text className="text-white text-xs font-bold">2</Text>
              </View>
              <Text className="block text-sm text-gray-700">在公众号对话框发送「绑定#{userInfo.user_code}」</Text>
            </View>
            <View className="flex items-start gap-3">
              <View className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                <Text className="text-white text-xs font-bold">3</Text>
              </View>
              <Text className="block text-sm text-gray-700">绑定成功后，发送链接即可自动收录</Text>
            </View>
          </View>

          <Button className="w-full bg-blue-500" onClick={handleCloseBindGuide}>
            <Text className="text-white">我知道了</Text>
          </Button>
        </View>
      </Dialog>
    </View>
  )
}
