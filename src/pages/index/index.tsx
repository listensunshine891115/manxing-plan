import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { 
  Sparkles, MapPin, Calendar, ChevronRight, 
  MessageCircle, Copy, Check, User, X, Link2, Plus
} from 'lucide-react-taro'
import { Inspiration } from '@/types'
import { Network } from '@/network'
import './index.css'

const typeConfig = {
  spot: { color: '#3B82F6', label: '景点', icon: '🏛️' },
  food: { color: '#F59E0B', label: '美食', icon: '🍜' },
  show: { color: '#8B5CF6', label: '演出', icon: '🎭' },
  hotel: { color: '#10B981', label: '住宿', icon: '🏨' }
}

const sourceConfig: Record<string, { color: string; label: string }> = {
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
  
  // 绑定引导弹窗（首次登录不可关闭）
  const [showBindGuide, setShowBindGuide] = useState(false)
  const [isFirstLogin, setIsFirstLogin] = useState(false)
  
  // 粘贴链接弹窗
  const [showPasteDialog, setShowPasteDialog] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [pasting, setPasting] = useState(false)
  
  // 用户码复制状态
  const [codeCopied, setCodeCopied] = useState(false)

  // 检查登录状态
  const checkLogin = async () => {
    try {
      const res = await Taro.getStorage({ key: 'userInfo' })
      if (res.data) {
        setUserInfo(res.data)
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
      const user = {
        id: 'user_' + Date.now(),
        openid: 'wx_test_' + Date.now(),
        nickname: '旅行者',
        user_code: generateUserCode(),
        wx_openid: ''
      }

      await Taro.setStorage({ key: 'userInfo', data: user })
      setUserInfo(user)
      setIsFirstLogin(true)
      setShowBindGuide(true)  // 首次登录强制显示绑定引导
      
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
        Taro.showToast({ title: '已复制', icon: 'success' })
        setTimeout(() => setCodeCopied(false), 2000)
      }
    })
  }

  // 关闭绑定引导（首次登录后可以关闭）
  const handleCloseBindGuide = async () => {
    setShowBindGuide(false)
    setIsFirstLogin(false)
    await Taro.setStorage({ key: 'bindGuideShown', data: true })
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
      // 调用后端接口收录链接
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
        // 刷新灵感列表
        fetchInspirations()
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

  // 粘贴剪贴板链接
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

  // 切换选中
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // 全选/取消
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
      <View className="min-h-screen bg-background flex flex-col items-center justify-center px-8">
        <View className="w-20 h-20 bg-blue-500 rounded-2xl flex items-center justify-center mb-6">
          <MapPin size={40} color="#fff" />
        </View>
        <Text className="block text-2xl font-bold text-foreground mb-2">此刻与你漫行</Text>
        <Text className="block text-sm text-muted-foreground mb-8 text-center">
          登录后获取专属用户码{'\n'}绑定公众号发送链接自动收录灵感
        </Text>
        <Button className="bg-blue-500 w-full max-w-xs" onClick={handleLogin}>
          <User size={18} color="#fff" />
          <Text className="text-white ml-2">微信一键登录</Text>
        </Button>
      </View>
    )
  }

  // 已登录状态
  return (
    <View className="min-h-screen bg-background pb-24">
      {/* 顶部状态栏 */}
      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <View className="flex items-center justify-between">
          <View className="flex items-center gap-2">
            <Sparkles size={18} color="#3b82f6" />
            <Text className="text-sm font-medium text-gray-900">{userInfo.nickname}</Text>
            <Badge variant="outline" className="text-xs font-mono">
              {userInfo.user_code}
            </Badge>
          </View>
          
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
                <Check size={12} color="#16a34a" />
                <Text>已绑定</Text>
              </>
            ) : (
              <>
                <MessageCircle size={12} color="#d97706" />
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
              <Text className="block text-xs text-gray-400">设置行程</Text>
            </View>
          </View>
          {/* 粘贴链接入口 */}
          <View 
            className="flex-1 bg-white rounded-xl p-4 flex items-center gap-3"
            onClick={() => setShowPasteDialog(true)}
          >
            <View className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Link2 size={20} color="#10b981" />
            </View>
            <View>
              <Text className="block text-sm font-medium text-gray-900">粘贴链接</Text>
              <Text className="block text-xs text-gray-400">收录灵感</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 提示 */}
      <View className="px-4 mb-4">
        <View className="bg-green-50 rounded-xl px-4 py-3 flex items-start gap-3">
          <MessageCircle size={16} color="#10b981" className="shrink-0 mt-1" />
          <View>
            <Text className="block text-sm text-green-800">
              发送分享链接给公众号即可自动收录
            </Text>
            {userInfo.wx_openid ? (
              <Text className="block text-xs text-green-600 mt-1">
                已绑定公众号
              </Text>
            ) : (
              <Text 
                className="block text-xs text-blue-600 mt-1"
                onClick={() => setShowBindGuide(true)}
              >
                点击绑定公众号
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* 灵感列表 */}
      {(['spot', 'food', 'show', 'hotel'] as const).map(type => {
        const items = groupedInspirations[type]
        if (items.length === 0) return null
        
        const typeInfo = typeConfig[type]
        const allSelected = items.every(i => selectedIds.includes(i.id))
        
        return (
          <View key={type} className="mb-4">
            <View className="px-4 flex items-center justify-between mb-2">
              <View className="flex items-center">
                <Text className="block mr-2">{typeInfo.icon}</Text>
                <Text className="block text-base font-medium text-foreground">{typeInfo.label}</Text>
                <Badge variant="secondary" className="ml-2 text-xs">{items.length}</Badge>
              </View>
              <Text 
                className="text-sm text-blue-500"
                onClick={() => toggleAll(type)}
              >
                {allSelected ? '取消' : '全选'}
              </Text>
            </View>

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
                            backgroundColor: sourceConfig[item.source]?.color + '20',
                            color: sourceConfig[item.source]?.color || '#64748B'
                          }}
                        >
                          {sourceConfig[item.source]?.label || '其他'}
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
          <Text className="block text-sm text-gray-400 text-center px-8 mb-4">
            点击「粘贴链接」收录灵感{'\n'}或关注公众号发送链接
          </Text>
          <Button className="bg-blue-500" onClick={() => setShowPasteDialog(true)}>
            <Plus size={16} color="#fff" />
            <Text className="text-white ml-2">粘贴链接</Text>
          </Button>
        </View>
      )}

      {/* 底部按钮 */}
      {inspirations.length > 0 && (
        <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 pb-8">
          <View className="flex items-center gap-3">
            <View className="flex-1">
              <Text className="block text-sm text-gray-500">
                已选 <Text className="text-blue-500 font-medium">{selectedIds.length}</Text> 项
              </Text>
            </View>
            <Button className="bg-blue-500 px-6" onClick={handleStartPlan}>
              <Text className="text-white">开始规划</Text>
              <ChevronRight size={16} color="#fff" className="ml-1" />
            </Button>
          </View>
        </View>
      )}

      {/* 绑定引导弹窗（首次登录不可跳过） */}
      <Dialog open={showBindGuide} onOpenChange={(open) => isFirstLogin || !open ? undefined : () => handleCloseBindGuide()}>
        <View className="p-6">
          {/* 关闭按钮（非首次可关闭） */}
          {!isFirstLogin && (
            <View className="flex justify-end mb-2" onClick={handleCloseBindGuide}>
              <X size={20} color="#9ca3af" />
            </View>
          )}
          
          <View className="text-center mb-4">
            <View className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageCircle size={24} color="#3b82f6" />
            </View>
            <Text className="block text-lg font-medium text-gray-900">绑定公众号</Text>
            <Text className="block text-sm text-gray-500 mt-1">
              绑定后发送链接自动收录到灵感库
            </Text>
          </View>

          {/* 公众号二维码 */}
          <View className="flex justify-center mb-4">
            <View className="bg-white p-2 rounded-xl border border-gray-200">
              <View className="w-40 h-40 bg-gray-100 flex items-center justify-center overflow-hidden rounded-lg">
                <Text className="text-xs text-gray-400">公众号二维码</Text>
                {/* 实际使用 Image 组件 */}
                {/* <Image src={MP_QRCODE} className="w-full h-full" mode="aspectFit" /> */}
              </View>
            </View>
          </View>

          {/* 用户码 */}
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <Text className="block text-xs text-gray-500 mb-2 text-center">或发送用户码给公众号</Text>
            <View className="flex items-center justify-center gap-3">
              <Text className="block text-2xl font-mono font-bold text-blue-600 tracking-widest">
                {userInfo.user_code}
              </Text>
              <Button size="sm" className="bg-white border border-gray-200" onClick={handleCopyCode}>
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

          {/* 步骤 */}
          <View className="space-y-2 mb-4">
            <View className="flex items-start gap-3">
              <View className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                <Text className="text-white text-xs">1</Text>
              </View>
              <Text className="block text-sm text-gray-700">扫描上方二维码或搜索「旅行助手」</Text>
            </View>
            <View className="flex items-start gap-3">
              <View className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                <Text className="text-white text-xs">2</Text>
              </View>
              <Text className="block text-sm text-gray-700">关注公众号并发送「绑定#{userInfo.user_code}」</Text>
            </View>
          </View>

          <Button className="w-full bg-blue-500" onClick={handleCloseBindGuide}>
            <Text className="text-white">知道了</Text>
          </Button>
        </View>
      </Dialog>

      {/* 粘贴链接弹窗 */}
      <Dialog open={showPasteDialog} onOpenChange={(open) => !open && setShowPasteDialog(false)}>
        <View className="p-6">
          <View className="flex justify-end mb-2" onClick={() => setShowPasteDialog(false)}>
            <X size={20} color="#9ca3af" />
          </View>
          
          <View className="text-center mb-4">
            <View className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Link2 size={24} color="#10b981" />
            </View>
            <Text className="block text-lg font-medium text-gray-900">粘贴链接</Text>
            <Text className="block text-sm text-gray-500 mt-1">
              粘贴旅行相关的分享链接即可收录
            </Text>
          </View>

          {/* 链接输入 */}
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <View className="flex items-center gap-2 mb-3">
              <Input 
                className="flex-1 bg-white"
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

          {/* 支持的平台 */}
          <View className="text-center">
            <Text className="block text-xs text-gray-400 mb-2">支持的平台</Text>
            <View className="flex justify-center gap-2 flex-wrap">
              {['小红书', '大众点评', '大麦', '携程', '马蜂窝'].map(platform => (
                <Badge key={platform} variant="secondary" className="text-xs">{platform}</Badge>
              ))}
            </View>
          </View>
        </View>
      </Dialog>
    </View>
  )
}
