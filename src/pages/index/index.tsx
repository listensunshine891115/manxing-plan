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
  primaryTag: string  // 一级标签：景点、美食
  secondaryTag?: string  // 二级标签：正餐、小吃、饮品、咖啡等
  price: string
  description: string
  tags: string[]
  highlights?: string[]
  sourceUrl: string
  selected: boolean
}

// 两级标签配置
const primaryTagConfig: Record<string, { label: string; icon: string; color: string }> = {
  '景点': { label: '景点', icon: '🏛️', color: '#3b82f6' },
  '美食': { label: '美食', icon: '🍜', color: '#f97316' },
}

const secondaryTagConfig: Record<string, { label: string; icon: string }> = {
  // 景点类
  '景区': { label: '景区', icon: '🏞️' },
  '博物馆': { label: '博物馆', icon: '🏛️' },
  '公园/广场': { label: '公园/广场', icon: '🌳' },
  '古迹遗址': { label: '古迹遗址', icon: '🏯' },
  '地标建筑': { label: '地标建筑', icon: '🗼' },
  '展览展馆': { label: '展览展馆', icon: '🎨' },
  '游乐场': { label: '游乐场', icon: '🎢' },
  '动物园/植物园': { label: '动物园/植物园', icon: '🦁' },
  '网红打卡点': { label: '网红打卡点', icon: '📸' },
  '文化体验': { label: '文化体验', icon: '🎭' },
  // 美食类
  '正餐': { label: '正餐', icon: '🍽️' },
  '小吃': { label: '小吃', icon: '🍢' },
  '饮品': { label: '饮品', icon: '🥤' },
  '咖啡': { label: '咖啡', icon: '☕' },
  '甜点': { label: '甜点', icon: '🍰' },
  '烧烤/烧鸟': { label: '烧烤/烧鸟', icon: '🍗' },
  '火锅': { label: '火锅', icon: '🍲' },
  '日料/韩料/西餐': { label: '日料/韩料/西餐', icon: '🍣' },
  '面馆/粉店': { label: '面馆/粉店', icon: '🍜' },
  '早茶/下午茶': { label: '早茶/下午茶', icon: '🍵' },
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
      console.log('[Paste] 开始预览，URL:', isUrl ? linkInput.trim() : '纯文字')
      Taro.showLoading({ title: '正在提取灵感...' })
      
      // 先预览多个灵感点（视频处理可能需要较长时间，设置120秒超时）
      const previewRes = await Network.request({
        url: '/api/trip/preview',
        method: 'POST',
        data: {
          userId: userInfo?.id,
          url: isUrl ? linkInput.trim() : undefined,
          text: !isUrl ? linkInput.trim() : undefined
        },
        timeout: 120000  // 120秒超时
      })
      
      Taro.hideLoading()
      console.log('[Paste] 预览响应:', JSON.stringify(previewRes))
      console.log('[Paste] previewRes.data:', JSON.stringify(previewRes?.data))
      
      if (previewRes.data?.success && previewRes.data?.data?.inspirationPoints?.length > 0) {
        // 有关灵感点，展示让用户选择
        console.log('[Paste] 提取到灵感点数量:', previewRes.data.data.inspirationPoints.length)
        
        // 确保每个灵感点都有 selected 属性
        const pointsWithSelected = previewRes.data.data.inspirationPoints.map((p: any) => ({
          ...p,
          selected: p.selected !== false // 默认选中
        }))
        
        console.log('[Paste] 处理后的灵感点:', JSON.stringify(pointsWithSelected[0]))
        
        setPreviewPoints(pointsWithSelected)
        setShowPasteDialog(false)
        setShowPreviewDialog(true)
        setLinkInput('')
      } else {
        // 没有提取到灵感点
        console.log('[Paste] 未能提取到灵感点:', JSON.stringify(previewRes.data))
        Taro.showToast({ title: previewRes.data?.message || '未能提取到灵感点', icon: 'none' })
      }
    } catch (error: any) {
      Taro.hideLoading()
      console.error('[Paste] 预览失败:', error)
      // 区分超时错误和其他错误
      const errorMsg = error.message || ''
      if (errorMsg.includes('abort') || errorMsg.includes('timeout') || errorMsg.includes('超时')) {
        Taro.showToast({ title: '请求超时，请重试或检查网络', icon: 'none' })
      } else {
        Taro.showToast({ title: '预览失败: ' + errorMsg, icon: 'none' })
      }
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
        primary_tag: point.primaryTag,
        secondary_tag: point.secondaryTag,
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

      console.log('[Save] 保存响应:', JSON.stringify(res))
      
      // 检查 code 字段或 success 字段
      if (res.data?.code === 200 || res.data?.success) {
        Taro.showToast({ title: `已收录 ${selectedPoints.length} 个灵感点`, icon: 'success' })
        setShowPreviewDialog(false)
        setPreviewPoints([])
        fetchInspirations()
      } else {
        console.error('[Save] 保存失败:', res.data)
        Taro.showToast({ title: res.data?.message || res.data?.msg || '保存失败', icon: 'none' })
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
  const toggleAll = (primaryTag: string) => {
    const tagIds = inspirations.filter(i => i.primary_tag === primaryTag).map(i => i.id)
    const allSelected = tagIds.every(id => selectedIds.includes(id))
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !tagIds.includes(id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...tagIds])])
    }
  }

  // 开始规划
  const handleStartPlan = () => {
    if (selectedIds.length === 0) {
      setSelectedIds(inspirations.map(i => i.id))
    }
    window.location.href = '/pages/generate/index?selected=' + selectedIds.join(',')
  }

  // 按一级标签分组
  const groupedInspirations = {
    '景点': inspirations.filter(i => i.primary_tag === '景点'),
    '美食': inspirations.filter(i => i.primary_tag === '美食'),
  }

  // 分类统计
  const categoryStats = [
    { tag: '景点', count: groupedInspirations['景点']?.length || 0, color: '#3b82f6', bgColor: '#dbeafe' },
    { tag: '美食', count: groupedInspirations['美食']?.length || 0, color: '#f97316', bgColor: '#ffedd5' },
  ]

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
            >
              {userInfo.wx_openid ? (
                <>
                  <Check size={12} color="#16a34a" />
                  <Text>已绑定</Text>
                </>
              ) : (
                <>
                  <Link2 size={12} color="#d97706" />
                  <Text onClick={goToBindGuide}>去绑定</Text>
                </>
              )}
            </View>
            <View onClick={goToSettings}>
              <Settings size={20} color="#6b7280" />
            </View>
          </View>
        </View>
      </View>

      {/* 分类统计卡片 */}
      {inspirations.length > 0 && (
        <View className="bg-white border-b border-gray-100 px-4 py-3">
          <View className="flex gap-3">
            {categoryStats.map(stat => (
              <View 
                key={stat.tag}
                className="flex-1 rounded-xl p-3 flex items-center justify-center"
                style={{ backgroundColor: stat.bgColor }}
              >
                <Text className="text-lg font-bold" style={{ color: stat.color }}>
                  {stat.count}
                </Text>
                <Text className="ml-2 text-sm text-gray-600">{stat.tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 粘贴灵感按钮 */}
      <View className="px-4 py-4">
        <Button 
          className="w-full bg-green-500 hover:bg-green-600 border-0"
          onClick={() => setShowPasteDialog(true)}
        >
          <Link2 size={18} color="#fff" />
          <Text className="text-white ml-2">粘贴灵感</Text>
        </Button>
      </View>

      {/* 灵感库列表 */}
      {Object.entries(groupedInspirations).map(([primaryTag, items]) => {
        const tagInfo = primaryTagConfig[primaryTag]
        const allSelected = items.length > 0 && items.every(item => selectedIds.includes(item.id))
        
        return (
          <View key={primaryTag} className="mb-4">
            {/* 分组标题 */}
            <View className="px-4 py-2 flex items-center justify-between">
              <View className="flex items-center">
                <Text className="block mr-2">{tagInfo.icon}</Text>
                <Text className="block text-base font-medium text-foreground">{tagInfo.label}</Text>
                <Badge variant="secondary" className="ml-2 text-xs">{items.length}</Badge>
              </View>
              <Text 
                className="text-sm text-blue-500"
                onClick={() => toggleAll(primaryTag)}
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
                        {/* 一级标签 */}
                        <Badge 
                          style={{ 
                            backgroundColor: (primaryTagConfig[item.primary_tag]?.color || '#64748b') + '20',
                            color: primaryTagConfig[item.primary_tag]?.color || '#64748b'
                          }}
                          className="text-xs"
                        >
                          {primaryTagConfig[item.primary_tag]?.icon || '📍'}{' '}
                          {primaryTagConfig[item.primary_tag]?.label || item.primary_tag}
                        </Badge>
                        {/* 二级标签 */}
                        {item.secondary_tag && (
                          <Badge variant="secondary" className="text-xs">
                            {secondaryTagConfig[item.secondary_tag]?.icon || ''}{' '}
                            {secondaryTagConfig[item.secondary_tag]?.label || item.secondary_tag}
                          </Badge>
                        )}
                        {/* 来源 */}
                        <Badge 
                          variant="outline" 
                          className="text-xs"
                          style={{ 
                            backgroundColor: sourceConfig[item.source]?.color + '10',
                            borderColor: sourceConfig[item.source]?.color || '#64748B'
                          }}
                        >
                          {sourceConfig[item.source]?.label || '其他'}
                        </Badge>
                        {/* 地点 */}
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

      {/* 预览灵感点弹窗 - 固定定位 */}
      {showPreviewDialog && (
        <View 
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => setShowPreviewDialog(false)}
        >
          <View 
            className="bg-white rounded-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <View className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <Text className="block text-lg font-medium text-gray-900">预览灵感点</Text>
              <View className="flex items-center gap-3">
                <Text 
                  className="text-sm text-blue-500"
                  onClick={toggleAllPreview}
                >
                  {previewPoints.every(p => p.selected) ? '取消全选' : '全选'}
                </Text>
                <View onClick={() => setShowPreviewDialog(false)}>
                  <Text className="text-2xl text-gray-400">×</Text>
                </View>
              </View>
            </View>

            {/* 统计信息 */}
            <View className="px-4 py-2 bg-gray-50 flex items-center justify-between">
              <Text className="text-sm text-gray-500">
                共 {previewPoints.length} 个灵感点，已选择 {previewPoints.filter(p => p.selected).length} 个
              </Text>
            </View>

            {/* 灵感点列表 */}
            <View className="flex-1 overflow-y-auto p-4 space-y-3">
              {previewPoints.map((point, index) => (
                <Card 
                  key={index}
                  className={`overflow-hidden ${point.selected ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => togglePointSelected(index)}
                >
                  <View className={`p-4 ${point.selected ? 'bg-blue-50' : 'bg-white'}`}>
                    <View className="flex items-start gap-3">
                      {/* 复选框 */}
                      <View 
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-1 ${
                          point.selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}
                      >
                        {point.selected && <Check size={12} color="#fff" />}
                      </View>

                      <View className="flex-1">
                        {/* 名称 */}
                        <Text className="block text-base font-medium text-gray-900 mb-2">
                          {point.name}
                        </Text>
                        
                        {/* 标签 */}
                        <View className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge 
                            style={{ 
                              backgroundColor: (primaryTagConfig[point.primaryTag]?.color || '#64748b') + '20',
                              color: primaryTagConfig[point.primaryTag]?.color || '#64748b'
                            }}
                          >
                            {primaryTagConfig[point.primaryTag]?.icon || '📍'}{' '}
                            {primaryTagConfig[point.primaryTag]?.label || point.primaryTag}
                          </Badge>
                          {point.secondaryTag && (
                            <Badge variant="secondary">
                              {secondaryTagConfig[point.secondaryTag]?.icon || ''}{' '}
                              {secondaryTagConfig[point.secondaryTag]?.label || point.secondaryTag}
                            </Badge>
                          )}
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
                      </View>
                    </View>
                  </View>
                </Card>
              ))}
            </View>

            {/* 保存按钮 */}
            <View className="p-4 border-t border-gray-100 flex-shrink-0">
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
        </View>
      )}
    </View>
  )
}
