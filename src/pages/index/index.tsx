import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { 
  Sparkles, MapPin, Calendar, ChevronRight, 
  Check, User, Settings, Link2
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

// 灵感点类型
interface InspirationPoint {
  name: string
  location: string
  time: string
  type: string
  price: string
  description: string
  tags: string[]
  highlights?: string[]
  sourceUrl: string
  selected: boolean
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

  // 粘贴链接弹窗
  const [showPasteDialog, setShowPasteDialog] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [pasting, setPasting] = useState(false)

  // 预览灵感点弹窗
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewPoints, setPreviewPoints] = useState<InspirationPoint[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

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
        // 映射数据格式
        const mappedData = res.data.data.map((item: any) => ({
          ...item,
          createTime: item.create_time || item.createTime,
          location_name: item.location_name || item.location?.name || '',
        }))
        setInspirations(mappedData)
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
      
      Taro.showToast({ title: '登录成功', icon: 'success' })
      
      // 跳转到绑定页面
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/bind-guide/index' })
      }, 500)
    } catch {
      Taro.showToast({ title: '登录失败', icon: 'none' })
    }
  }

  // 生成用户码
  const generateUserCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  // 跳转到绑定页面
  const goToBindGuide = () => {
    Taro.navigateTo({ url: '/pages/bind-guide/index' })
  }

  // 跳转到设置页面
  const goToSettings = () => {
    Taro.navigateTo({ url: '/pages/settings/index' })
  }

  // 粘贴链接收录
  const handlePasteLink = async () => {
    if (!linkInput.trim()) {
      Taro.showToast({ title: '请输入链接或文字', icon: 'none' })
      return
    }

    // 判断是链接还是纯文字
    const isUrl = linkInput.includes('http://') || linkInput.includes('https://')

    setPasting(true)
    try {
      // 先预览多个灵感点
      const previewRes = await Network.request({
        url: '/api/trip/preview',
        method: 'POST',
        data: {
          userId: userInfo?.id,
          url: isUrl ? linkInput.trim() : undefined,
          text: !isUrl ? linkInput.trim() : undefined
        }
      })
      
      console.log('预览结果:', previewRes.data)
      
      if (previewRes.data?.success && previewRes.data?.data?.inspirationPoints?.length > 0) {
        // 有关灵感点，展示让用户选择
        setPreviewPoints(previewRes.data.data.inspirationPoints)
        setShowPasteDialog(false)
        setShowPreviewDialog(true)
        setLinkInput('')
      } else {
        // 没有提取到灵感点，直接收录
        Taro.showToast({ title: previewRes.data?.message || '未能提取到灵感点', icon: 'none' })
      }
    } catch (error) {
      console.error('预览失败:', error)
      Taro.showToast({ title: '预览失败', icon: 'none' })
    } finally {
      setPasting(false)
    }
  }

  // 保存选中的灵感点
  const handleSaveSelected = async () => {
    const selectedPoints = previewPoints.filter(p => p.selected)
    
    if (selectedPoints.length === 0) {
      Taro.showToast({ title: '请至少选择一个灵感点', icon: 'none' })
      return
    }

    setPreviewLoading(true)
    try {
      // 批量保存
      const items = selectedPoints.map(point => ({
        user_id: userInfo?.id,
        title: point.name,
        source: 'xiaohongshu',
        type: point.type,
        location_name: point.location,
        time: point.time,
        price: point.price,
        description: point.description,
        original_url: point.sourceUrl,
        tags: point.tags
      }))

      const res = await Network.request({
        url: '/api/trip/inspirations/batch',
        method: 'POST',
        data: { items }
      })

      if (res.data?.success) {
        Taro.showToast({ title: `已收录 ${selectedPoints.length} 个灵感点`, icon: 'success' })
        setShowPreviewDialog(false)
        setPreviewPoints([])
        fetchInspirations()
      } else {
        Taro.showToast({ title: res.data?.message || '保存失败', icon: 'none' })
      }
    } catch (error) {
      console.error('保存失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setPreviewLoading(false)
    }
  }

  // 切换灵感点选中状态
  const togglePointSelected = (index: number) => {
    setPreviewPoints(prev => prev.map((point, i) => 
      i === index ? { ...point, selected: !point.selected } : point
    ))
  }

  // 全选/取消全选预览
  const toggleAllPreview = () => {
    const allSelected = previewPoints.every(p => p.selected)
    setPreviewPoints(prev => prev.map(point => ({ ...point, selected: !allSelected })))
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
          
          <View className="flex items-center gap-2">
            <View 
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs"
              style={{ 
                backgroundColor: userInfo.wx_openid ? '#dcfce7' : '#fef3c7',
                color: userInfo.wx_openid ? '#16a34a' : '#d97706'
              }}
              onClick={goToBindGuide}
            >
              {userInfo.wx_openid ? (
                <>
                  <Check size={12} color="#16a34a" />
                  <Text>已绑定</Text>
                </>
              ) : (
                <>
                  <Check size={12} color="#d97706" />
                  <Text>未绑定</Text>
                </>
              )}
            </View>
            
            <View 
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"
              onClick={goToSettings}
            >
              <Settings size={18} color="#6b7280" />
            </View>
          </View>
        </View>
      </View>

      {/* 快捷入口 */}
      <View className="px-4 py-4">
        <View className="bg-white rounded-xl p-4 flex items-center gap-3"
          onClick={() => window.location.href = '/pages/generate/index'}
        >
          <View className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Calendar size={20} color="#3b82f6" />
          </View>
          <View className="flex-1">
            <Text className="block text-sm font-medium text-gray-900">出行设置</Text>
            <Text className="block text-xs text-gray-400">设置行程日期和偏好</Text>
          </View>
          <ChevronRight size={18} color="#9ca3af" />
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
                      <View className="flex items-center gap-2 flex-wrap">
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
                        {item.location_name && (
                          <View className="flex items-center gap-1">
                            <MapPin size={10} color="#6b7280" />
                            <Text className="block text-xs text-gray-500">{item.location_name}</Text>
                          </View>
                        )}
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
            点击「粘贴灵感」收录{'\n'}短视频、票务平台、公众号文章&quot;链接&quot;
          </Text>
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

      {/* 粘贴灵感弹窗 */}
      <Dialog open={showPasteDialog} onOpenChange={(open) => !open && setShowPasteDialog(false)}>
        <View className="p-6">
          <View className="text-center mb-4">
            <View className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Link2 size={24} color="#10b981" />
            </View>
            <Text className="block text-lg font-medium text-gray-900">粘贴灵感</Text>
            <Text className="block text-sm text-gray-500 mt-1">
              粘贴你的：种草短视频、票务平台、公众号文章&quot;链接&quot;，一键形成灵感库
            </Text>
          </View>
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <View className="mb-3">
              <Input 
                className="w-full bg-white"
                placeholder="粘贴链接..."
                value={linkInput}
                onInput={(e: any) => setLinkInput(e.target.value)}
              />
            </View>
            <View className="flex gap-2">
              <Button 
                className="flex-1 bg-white border border-gray-200"
                onClick={handlePasteFromClipboard}
              >
                <Text className="text-blue-600">粘贴</Text>
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

      {/* 预览灵感点弹窗 */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => !open && setShowPreviewDialog(false)}>
        <View className="p-4 max-h-[70vh] overflow-y-auto">
          <View className="text-center mb-4">
            <Text className="block text-lg font-medium text-gray-900">发现 {previewPoints.length} 个灵感点</Text>
            <Text className="block text-sm text-gray-500 mt-1">选择你想要收录的灵感点</Text>
          </View>
          
          {/* 全选 */}
          <View className="flex items-center justify-between mb-3 px-2">
            <View className="flex items-center gap-2">
              <Checkbox 
                checked={previewPoints.every(p => p.selected)}
                onCheckedChange={toggleAllPreview}
              />
              <Text className="block text-sm text-gray-600">全选</Text>
            </View>
            <Text className="block text-sm text-blue-500">
              已选 {previewPoints.filter(p => p.selected).length} 个
            </Text>
          </View>

          {/* 灵感点列表 */}
          <View className="space-y-3">
            {previewPoints.map((point, index) => (
              <View 
                key={index}
                className={`bg-gray-50 rounded-xl p-4 border-2 transition-all ${
                  point.selected ? 'border-blue-500' : 'border-transparent'
                }`}
                onClick={() => togglePointSelected(index)}
              >
                <View className="flex gap-3">
                  {/* 复选框 */}
                  <View className="flex items-start pt-1">
                    <Checkbox 
                      checked={point.selected}
                      onCheckedChange={() => togglePointSelected(index)}
                    />
                  </View>
                  
                  {/* 内容 */}
                  <View className="flex-1">
                    {/* 标题和类型 */}
                    <View className="flex items-center gap-2 mb-2">
                      <Text className="block text-base font-medium text-gray-900 flex-1">
                        {point.name}
                      </Text>
                      <Badge 
                        variant="secondary" 
                        style={{ 
                          backgroundColor: (typeConfig[point.type as keyof typeof typeConfig]?.color || '#64748b') + '20',
                          color: typeConfig[point.type as keyof typeof typeConfig]?.color || '#64748b'
                        }}
                      >
                        {typeConfig[point.type as keyof typeof typeConfig]?.icon || '📍'}{' '}
                        {typeConfig[point.type as keyof typeof typeConfig]?.label || '其他'}
                      </Badge>
                    </View>
                    
                    {/* 地点和时间 */}
                    <View className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                      {point.location && (
                        <View className="flex items-center gap-1">
                          <MapPin size={12} color="#6b7280" />
                          <Text className="block">{point.location}</Text>
                        </View>
                      )}
                      {point.time && (
                        <View className="flex items-center gap-1">
                          <Calendar size={12} color="#6b7280" />
                          <Text className="block">{point.time}</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* 价格 */}
                    {point.price && point.price !== '待定' && (
                      <Text className="block text-sm text-orange-500 mb-2">
                        💰 {point.price}
                      </Text>
                    )}
                    
                    {/* 描述 */}
                    <Text className="block text-sm text-gray-600 mb-2">
                      {point.description}
                    </Text>
                    
                    {/* 亮点标签 */}
                    {(point.tags?.length > 0 || (point.highlights && point.highlights.length > 0)) && (
                      <View className="flex flex-wrap gap-2">
                        {(point.tags || []).slice(0, 4).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs px-2 py-1">
                            {tag}
                          </Badge>
                        ))}
                      </View>
                    )}
                    
                    {/* 来源链接 */}
                    {point.sourceUrl && (
                      <Text className="block text-xs text-gray-400 mt-2 truncate">
                        来源: {point.sourceUrl}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* 保存按钮 */}
          <View className="mt-4">
            <Button 
              className="w-full bg-blue-500"
              onClick={handleSaveSelected}
              disabled={previewLoading}
            >
              <Text className="text-white">
                {previewLoading ? '保存中...' : `收录 ${previewPoints.filter(p => p.selected).length} 个灵感点`}
              </Text>
            </Button>
          </View>
        </View>
      </Dialog>
    </View>
  )
}
