import { useState, useEffect } from 'react'
import { View, Text, Image, Picker } from '@tarojs/components'
import { Button as UIButton } from '@/components/ui/button'
import { ShareButton } from '@/components/share-button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { 
  ArrowLeft, Share2, ChevronUp, ChevronDown, MapPin, Clock, 
  Navigation, Sparkles, Route as RouteIcon, Circle, Users, ThumbsUp, X, Plus, Copy
} from 'lucide-react-taro'
import { Network } from '@/network'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import './index.css'

// 类型定义
interface RouteItem {
  id: string
  title: string
  image?: string
  type?: string
  location: { name: string; lat: number; lng: number }
  locationSource?: 'original' | 'mock'
  distance?: number
  original_url?: string  // 原始链接
}

interface ItineraryItem {
  id: string
  inspirationId: string
  title: string
  image: string
  location: { name: string; lat: number; lng: number }
  type: string
  startTime: string
  duration: number
  distance?: number
  note?: string
  original_url?: string  // 原始链接
}

interface TripDay {
  day: number
  date: string
  items: ItineraryItem[]
}

interface RoutePlanResult {
  route: RouteItem[]
  statistics: {
    totalPoints: number
    locatedPoints: number
    totalDistance: number
  }
  itinerary: TripDay[]
  settings: {
    days: number
    startDate: string
    mainDestination?: string
  }
}

interface RouteVersion {
  id: string
  versionName: string
  content: TripDay[]
  voteCount: number
}

// 类型配置
const typeConfig: Record<string, { color: string; label: string }> = {
  spot: { color: '#3B82F6', label: '景点' },
  food: { color: '#F59E0B', label: '美食' },
  shopping: { color: '#EC4899', label: '购物' },
  activity: { color: '#8B5CF6', label: '活动' },
  hotel: { color: '#10B981', label: '住宿' },
  show: { color: '#8B5CF6', label: '演出' }
}

export default function Route() {
  const [activeVersion, setActiveVersion] = useState('v1')
  const [expandedDays, setExpandedDays] = useState<number[]>([1, 2, 3])
  const [routePlan, setRoutePlan] = useState<RoutePlanResult | null>(null)
  const [versions, setVersions] = useState<RouteVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [voteSession, setVoteSession] = useState<{ shareCode: string; sessionId: string; voteDeadline: string } | null>(null)
  const [voteStats, setVoteStats] = useState<Record<string, { likes: number; dislikes: number }>>({})
  const [voteSettingVisible, setVoteSettingVisible] = useState(false)
  
  // 当前路线分享代码
  const [shareCode] = useState(() => {
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const options = (currentPage as any)?.options || {}
    return options.code || options.shareCode || ''
  })
  
  // 分享给微信好友
  useShareAppMessage(() => {
    const tripId = routePlan?.settings?.mainDestination || 'trip'
    const days = routePlan?.settings?.days || 3
    return {
      title: `【漫行计划】${tripId} ${days}日游路线`,
      path: `/pages/route/index?code=${shareCode}`,
      imageUrl: routePlan?.itinerary?.[0]?.items?.[0]?.image || ''
    }
  })
  
  // 分享到朋友圈
  useShareTimeline(() => {
    const tripId = routePlan?.settings?.mainDestination || 'trip'
    const days = routePlan?.settings?.days || 3
    return {
      title: `【漫行计划】${tripId} ${days}日游路线，等你来投票！`,
      query: `code=${shareCode}`
    }
  })
  
  // 分享到微信好友
  useShareAppMessage(() => {
    const tripId = routePlan?.settings?.mainDestination || 'trip'
    const days = routePlan?.settings?.days || 3
    return {
      title: `【漫行计划】${tripId} ${days}日游路线`,
      path: `/pages/route/index?code=${shareCode}`
    }
  })
  
  // 获取北京时间日期字符串 (格式: YYYY-MM-DD)
  const [voteSetting, setVoteSetting] = useState({
    startDate: '',
    endDate: '',
    meetupPlace: [] as string[],
    meetupInput: '',
    voteDeadline: '',
  })

  // 加载路线规划结果
  useEffect(() => {
    const loadRoutePlan = async () => {
      try {
        // 从缓存获取路线规划结果
        const result = await Taro.getStorage({ key: 'routePlanResult' })
        console.log('[Route] 从缓存获取路线规划结果:', result.data)

        if (result.data) {
          const plan = result.data as RoutePlanResult
          setRoutePlan(plan)

          // 生成路线版本（目前只有一个版本，后续可以扩展多个方案）
          const routeVersions: RouteVersion[] = [
            {
              id: 'v1',
              versionName: '智能优化路线',
              content: plan.itinerary,
              voteCount: 0
            }
          ]
          setVersions(routeVersions)

          // 默认展开所有天
          setExpandedDays(plan.itinerary.map(d => d.day))
        }
      } catch (error) {
        console.error('[Route] 加载路线规划结果失败:', error)
        Taro.showToast({ title: '加载路线失败', icon: 'none' })
      } finally {
        setLoading(false)
      }
    }

    loadRoutePlan()
  }, [])

  const currentVersion = versions.find(v => v.id === activeVersion) || versions[0]

  const toggleDay = (day: number) => {
    setExpandedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    )
  }

  const handleConfirm = () => {
    Taro.showToast({ title: '行程已确认！', icon: 'success' })
  }

  // 处理分享投票
  const handleShareVote = async () => {
    if (!routePlan) return

    // 如果已有投票会话，显示分享链接
    if (voteSession) {
      const shareUrl = `/pages/vote/index?code=${voteSession.shareCode}`
      Taro.showModal({
        title: '分享投票链接',
        content: `好友打开即可投票参与路线设计！\n\n链接：${shareUrl}`,
        confirmText: '复制链接',
        cancelText: '关闭',
        success: (modalRes) => {
          if (modalRes.confirm) {
            Taro.setClipboardData({
              data: shareUrl,
              success: () => {
                Taro.showToast({ title: '链接已复制', icon: 'success' })
              }
            })
          }
        }
      })
      return
    }

    // 初始化投票设置
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const deadlineStr = `${threeDaysLater.getFullYear()}-${String(threeDaysLater.getMonth() + 1).padStart(2, '0')}-${String(threeDaysLater.getDate()).padStart(2, '0')}T23:59`
    
    setVoteSetting({
      startDate: todayStr + 'T09:00',
      endDate: todayStr + 'T18:00',
      meetupPlace: [],
      meetupInput: '',
      voteDeadline: deadlineStr,
    })
    setVoteSettingVisible(true)
  }

  // 添加集合地点标签
  const handleAddMeetupPlace = () => {
    const value = voteSetting.meetupInput.trim()
    if (value && !voteSetting.meetupPlace.includes(value)) {
      setVoteSetting(prev => ({
        ...prev,
        meetupPlace: [...prev.meetupPlace, value],
        meetupInput: '',
      }))
    }
  }

  // 删除集合地点标签
  const handleRemoveMeetupPlace = (index: number) => {
    setVoteSetting(prev => ({
      ...prev,
      meetupPlace: prev.meetupPlace.filter((_, i) => i !== index),
    }))
  }

  // 确认创建投票
  const handleConfirmVote = async () => {
    if (!routePlan) return

    try {
      Taro.showLoading({ title: '创建投票...' })
      setVoteSettingVisible(false)

      // 获取用户信息
      const userInfo = Taro.getStorageSync('userInfo')
      const nickname = userInfo?.nickname || '旅行达人'

      // 准备灵感点数据
      const inspirationPoints = routePlan.route.map(item => ({
        id: item.id,
        title: item.title,
        image: item.image,
        location: item.location,
        type: item.type,
        primaryTag: typeConfig[item.type || 'spot']?.label || '景点',
      }))

      // 创建投票会话
      const res = await Network.request({
        url: '/api/vote/sessions',
        method: 'POST',
        data: {
          tripId: 'route_' + Date.now(),
          title: routePlan.settings.mainDestination || '漫行计划',
          creatorName: nickname,
          inspirationPoints,
          startDate: voteSetting.startDate,
          endDate: voteSetting.endDate,
          meetupPlace: voteSetting.meetupPlace,
          voteDeadline: new Date(voteSetting.voteDeadline).toISOString(),
        },
      })

      console.log('[Route] 创建投票会话响应:', res.data)

      if (res.data.code === 200 && res.data.data) {
        const { shareCode: newShareCode, sessionId: newSessionId, voteDeadline: newVoteDeadline } = res.data.data
        setVoteSession({ shareCode: newShareCode, sessionId: newSessionId, voteDeadline: newVoteDeadline })

        // 加载投票统计
        loadVoteStats(newSessionId)

        // 生成分享链接
        const voteShareUrl = `/pages/vote/index?code=${newShareCode}`

        Taro.hideLoading()

        // 显示分享选项
        Taro.showModal({
          title: '投票已创建！',
          content: `截止时间：${new Date(newVoteDeadline).toLocaleString('zh-CN')}\n\n好友打开链接即可投票`,
          confirmText: '复制链接',
          cancelText: '稍后',
          success: (modalRes) => {
            if (modalRes.confirm) {
              Taro.setClipboardData({
                data: voteShareUrl,
                success: () => {
                  Taro.showToast({ title: '链接已复制', icon: 'success' })
                }
              })
            }
          }
        })
      } else {
        Taro.hideLoading()
        Taro.showToast({ title: res.data.msg || '创建失败', icon: 'none' })
      }
    } catch (error) {
      Taro.hideLoading()
      console.error('[Route] 创建投票会话失败:', error)
      Taro.showToast({ title: '创建失败，请重试', icon: 'none' })
    }
  }

  // 加载投票统计
  const loadVoteStats = async (sessionId: string) => {
    try {
      const res = await Network.request({
        url: `/api/vote/results/${sessionId}`,
      })

      if (res.data.code === 200 && res.data.data) {
        const stats: Record<string, { likes: number; dislikes: number }> = {}
        res.data.data.forEach((item: { inspirationId: string; likes: number; dislikes: number }) => {
          stats[item.inspirationId] = { likes: item.likes, dislikes: item.dislikes }
        })
        setVoteStats(stats)
      }
    } catch (error) {
      console.error('[Route] 加载投票统计失败:', error)
    }
  }

  const handleRegenerate = () => {
    Taro.navigateBack()
  }

  const handleItemClick = (item: ItineraryItem) => {
    // 导航到该地点
    if (item.location.lat && item.location.lng) {
      Taro.openLocation({
        latitude: item.location.lat,
        longitude: item.location.lng,
        name: item.title,
        address: item.location.name
      })
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <View className="text-center">
          <Sparkles size={40} color="#3B82F6" className="animate-pulse mx-auto mb-4" />
          <Text className="block text-gray-500">加载路线规划中...</Text>
        </View>
      </View>
    )
  }

  if (!routePlan) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <View className="text-center px-4">
          <Text className="block text-gray-500 mb-4">暂无路线规划结果</Text>
          <UIButton onClick={handleRegenerate}>
            <Sparkles size={16} color="#fff" />
            <Text className="text-white ml-2">重新规划</Text>
          </UIButton>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-32">
      {/* 顶部导航 */}
      <View className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <View className="flex items-center justify-between">
          <View className="flex items-center">
            <UIButton variant="ghost" size="icon" onClick={() => Taro.navigateBack()}>
              <ArrowLeft size={24} color="#1E293B" />
            </UIButton>
            <Text className="block text-lg font-semibold text-foreground ml-2">路线方案</Text>
          </View>
          {/* 使用 ShareButton 组件触发微信分享 */}
          <ShareButton className="h-10 w-10 flex items-center justify-center">
            <Share2 size={20} color="#3B82F6" />
          </ShareButton>
        </View>
      </View>

      {/* 统计信息 */}
      <View className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <View className="flex items-center justify-around">
          <View className="text-center">
            <Text className="block text-xl font-bold text-blue-600">{routePlan.statistics.totalPoints}</Text>
            <Text className="block text-xs text-gray-500 mt-1">灵感点</Text>
          </View>
          <View className="w-px h-8 bg-blue-200" />
          <View className="text-center">
            <Text className="block text-xl font-bold text-blue-600">{routePlan.statistics.locatedPoints}</Text>
            <Text className="block text-xs text-gray-500 mt-1">已定位</Text>
          </View>
          <View className="w-px h-8 bg-blue-200" />
          <View className="text-center">
            <Text className="block text-xl font-bold text-blue-600">{routePlan.statistics.totalDistance}</Text>
            <Text className="block text-xs text-gray-500 mt-1">公里</Text>
          </View>
          <View className="w-px h-8 bg-blue-200" />
          <View className="text-center">
            <Text className="block text-xl font-bold text-blue-600">{routePlan.settings.days}</Text>
            <Text className="block text-xs text-gray-500 mt-1">天行程</Text>
          </View>
        </View>
      </View>

      {/* 版本切换 Tab */}
      {versions.length > 1 && (
        <View className="px-4 py-3 border-b border-border" style={{ backgroundColor: '#F8FAFC' }}>
          <Tabs value={activeVersion} onValueChange={setActiveVersion}>
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
              {versions.map((v, index) => (
                <TabsTrigger
                  key={v.id}
                  value={v.id}
                  className="px-4 py-2 text-sm whitespace-nowrap"
                >
                  版本{index + 1} · {v.versionName}
                  {v.voteCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {v.voteCount}票
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </View>
      )}

      {/* 路线日程 */}
      <View className="px-4 py-4 space-y-4">
        {currentVersion?.content.map((day) => (
          <View key={day.day} className="day-section">
            {/* 天数标题 */}
            <View
              className="day-header"
              onClick={() => toggleDay(day.day)}
            >
              <View className="day-info">
                <View className="day-number">Day {day.day}</View>
                <Text className="block text-sm text-muted-foreground">{day.date}</Text>
              </View>
              <View className="flex items-center">
                <Badge variant="secondary" className="mr-2">
                  {day.items.length}个地点
                </Badge>
                {expandedDays.includes(day.day) ? (
                  <ChevronUp size={20} color="#64748B" />
                ) : (
                  <ChevronDown size={20} color="#64748B" />
                )}
              </View>
            </View>

            {/* 展开的日程项 */}
            {expandedDays.includes(day.day) && (
              <View className="day-items">
                {day.items.map((item, index) => (
                  <View key={item.id} className="trip-item" onClick={() => handleItemClick(item)}>
                    {/* 时间线 */}
                    <View className="timeline">
                      <View className="timeline-dot" />
                      {index < day.items.length - 1 && (
                        <View className="timeline-line">
                          {item.distance && (
                            <View className="distance-label">
                              <Text className="block text-xs text-gray-400">{item.distance}km</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    {/* 内容 */}
                    <View className="item-content">
                      <View className="flex items-start gap-3">
                        {item.image ? (
                          <Image
                            src={item.image}
                            className="w-16 h-16 rounded-lg object-cover"
                            mode="aspectFill"
                          />
                        ) : (
                          <View className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Text className="block text-2xl">
                              {item.type === 'food' ? '🍜' : item.type === 'shopping' ? '🛍️' : item.type === 'activity' ? '🎭' : '🏛️'}
                            </Text>
                          </View>
                        )}
                        <View className="flex-1 min-w-0">
                          <View className="flex items-center justify-between mb-1">
                            <View className="flex items-center gap-2 flex-1 min-w-0">
                              <Text className="block text-sm font-medium text-foreground truncate">
                                {item.title}
                              </Text>
                              <Badge
                                className="text-xs px-2 py-1"
                                style={{ backgroundColor: typeConfig[item.type]?.color || '#3B82F6' }}
                              >
                                {typeConfig[item.type]?.label || '地点'}
                              </Badge>
                            </View>
                            {/* 投票统计 */}
                            {voteSession && voteStats[item.inspirationId] && (
                              <View className="flex items-center gap-1 ml-2 shrink-0">
                                <ThumbsUp size={12} color="#22C55E" />
                                <Text className="text-xs text-green-500">
                                  {voteStats[item.inspirationId].likes}
                                </Text>
                                <Text className="text-xs text-gray-300 mx-1">/</Text>
                                <Text className="text-xs text-red-400">
                                  {voteStats[item.inspirationId].dislikes}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View className="flex items-center text-xs text-muted-foreground mb-1">
                            <MapPin size={12} color="#94A3B8" className="mr-1" />
                            <Text className="block truncate">{item.location.name}</Text>
                          </View>
                          {item.startTime && (
                            <View className="flex items-center text-xs text-muted-foreground">
                              <Clock size={12} color="#94A3B8" className="mr-1" />
                              <Text className="block">{item.startTime}</Text>
                              {item.duration && (
                                <Text className="block ml-1">· {item.duration}分钟</Text>
                              )}
                            </View>
                          )}
                          {item.note && (
                            <Text className="block text-xs text-orange-500 mt-1">
                              {item.note}
                            </Text>
                          )}
                          {/* 原始链接标签 */}
                          {item.original_url && (
                            <View 
                              className="mt-2 px-2 py-1 bg-blue-50 rounded-lg inline-flex items-center"
                              onClick={() => {
                                const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
                                if (isWeapp) {
                                  Taro.navigateTo({
                                    url: `/pages/webview/index?url=${encodeURIComponent(item.original_url || '')}`
                                  }).catch(() => {
                                    Taro.setClipboardData({ data: item.original_url || '' })
                                    Taro.showToast({ title: '链接已复制', icon: 'none' })
                                  })
                                } else {
                                  window.location.href = item.original_url || ''
                                }
                              }}
                            >
                              <Text className="text-xs text-blue-600">来源链接</Text>
                              <Text className="text-xs text-gray-400 ml-1">↗</Text>
                            </View>
                          )}
                        </View>
                        <UIButton variant="ghost" size="icon" className="shrink-0">
                          <Navigation size={18} color="#3B82F6" />
                        </UIButton>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* 投票信息 */}
      {voteSession && (
        <View className="mx-4 mt-2 p-3 bg-green-50 rounded-xl border border-green-200">
          <View className="flex items-center justify-between mb-2">
            <View className="flex items-center">
              <Users size={16} color="#22C55E" className="mr-2" />
              <Text className="text-sm text-green-600 font-medium">投票已开启</Text>
            </View>
            <Text className="text-xs text-green-500">
              截止：{new Date(voteSession.voteDeadline).toLocaleDateString('zh-CN')}
            </Text>
          </View>
          <View 
            className="p-2 bg-white rounded-lg"
            onClick={() => {
              const shareUrl = `/pages/vote/index?code=${voteSession.shareCode}`
              Taro.setClipboardData({
                data: shareUrl,
                success: () => Taro.showToast({ title: '链接已复制', icon: 'success' })
              })
            }}
          >
            <Text className="text-xs text-gray-500">点击复制投票链接</Text>
          </View>
        </View>
      )}

      {/* 底部操作栏 */}
      <View 
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff', borderTop: '1px solid #e5e5e5',
          padding: '16px', paddingBottom: '32px', zIndex: 100
        }}
      >
        <View className="flex gap-3 mb-3">
          {/* 分享投票按钮 - 有投票会话时使用 ShareButton 触发微信分享 */}
          {voteSession ? (
            <ShareButton className="flex-1 h-12 bg-white border border-green-500 rounded-lg flex items-center justify-center">
              <Copy size={18} color="#22C55E" className="mr-2" />
              <Text style={{ color: '#22C55E' }}>分享投票</Text>
            </ShareButton>
          ) : (
            <UIButton
              variant="outline"
              className="flex-1 h-12"
              onClick={handleShareVote}
            >
              <Copy size={18} color="#3B82F6" className="mr-2" />
              <Text style={{ color: '#3B82F6' }}>邀请投票</Text>
            </UIButton>
          )}
          <UIButton
            className="flex-1 h-12 text-base font-medium"
            onClick={handleConfirm}
          >
            <Circle size={18} color="#fff" className="mr-2" />
            <Text className="text-white">确认行程</Text>
          </UIButton>
        </View>
        <UIButton
          variant="ghost"
          className="w-full h-10 text-gray-500"
          onClick={handleRegenerate}
        >
          <RouteIcon size={16} color="#64748B" className="mr-2" />
          <Text className="text-gray-500">重新规划</Text>
        </UIButton>
      </View>

      {/* 投票设置弹窗 */}
      <Dialog open={voteSettingVisible} onOpenChange={setVoteSettingVisible}>
        <DialogContent className="max-w-md mx-auto">
          <View className="p-4">
            <Text className="block text-lg font-semibold text-gray-800 mb-4">投票设置</Text>

            {/* 旅行日期 - 重新设计 */}
            <View className="mb-4">
              <Text className="block text-sm font-medium text-gray-700 mb-2">旅行日期</Text>
              <View className="bg-gray-50 rounded-xl p-4">
                {/* 出发日期时间 */}
                <View className="mb-3">
                  <Text className="block text-xs text-gray-500 mb-2">出发时间</Text>
                  <View className="flex items-center gap-2">
                    <View className="flex-1">
                      <Picker
                        mode="date"
                        value={voteSetting.startDate.split('T')[0] || ''}
                        onChange={(e: any) => {
                          const newDate = e.detail.value
                          setVoteSetting(prev => ({
                            ...prev,
                            startDate: newDate + 'T' + (prev.startDate.split('T')[1] || '09:00')
                          }))
                        }}
                      >
                        <View className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center">
                          <Text className="text-sm text-gray-900 flex-1">
                            {voteSetting.startDate.split('T')[0] || '选择日期'}
                          </Text>
                          <Text className="text-xs text-gray-400">▼</Text>
                        </View>
                      </Picker>
                    </View>
                    <Picker
                      mode="time"
                      value={voteSetting.startDate.split('T')[1] || '09:00'}
                      onChange={(e: any) => {
                        const newTime = e.detail.value
                        setVoteSetting(prev => ({
                          ...prev,
                          startDate: prev.startDate.split('T')[0] + 'T' + newTime
                        }))
                      }}
                    >
                      <View className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-center">
                        <Text className="text-sm text-gray-900">
                          {voteSetting.startDate.split('T')[1]?.slice(0, 5) || '09:00'}
                        </Text>
                      </View>
                    </Picker>
                  </View>
                </View>
                
                {/* 返程日期时间 */}
                <View>
                  <Text className="block text-xs text-gray-500 mb-2">返程时间</Text>
                  <View className="flex items-center gap-2">
                    <View className="flex-1">
                      <Picker
                        mode="date"
                        value={voteSetting.endDate.split('T')[0] || ''}
                        onChange={(e: any) => {
                          const newDate = e.detail.value
                          setVoteSetting(prev => ({
                            ...prev,
                            endDate: newDate + 'T' + (prev.endDate.split('T')[1] || '18:00')
                          }))
                        }}
                      >
                        <View className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center">
                          <Text className="text-sm text-gray-900 flex-1">
                            {voteSetting.endDate.split('T')[0] || '选择日期'}
                          </Text>
                          <Text className="text-xs text-gray-400">▼</Text>
                        </View>
                      </Picker>
                    </View>
                    <Picker
                      mode="time"
                      value={voteSetting.endDate.split('T')[1] || '18:00'}
                      onChange={(e: any) => {
                        const newTime = e.detail.value
                        setVoteSetting(prev => ({
                          ...prev,
                          endDate: prev.endDate.split('T')[0] + 'T' + newTime
                        }))
                      }}
                    >
                      <View className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-center">
                        <Text className="text-sm text-gray-900">
                          {voteSetting.endDate.split('T')[1]?.slice(0, 5) || '18:00'}
                        </Text>
                      </View>
                    </Picker>
                  </View>
                </View>
                
                <Text className="block text-xs text-gray-400 mt-2">允许同一天，只需返程时间晚于出发时间</Text>
              </View>
            </View>

            {/* 集合地点 */}
            <View className="mb-4">
              <Text className="block text-sm font-medium text-gray-700 mb-2">集合地点</Text>
              <View className="flex flex-wrap gap-2 mb-2">
                {voteSetting.meetupPlace.map((place, index) => (
                  <View key={index} className="flex items-center px-3 py-1 bg-blue-50 rounded-full">
                    <MapPin size={12} color="#3B82F6" className="mr-1" />
                    <Text className="text-sm text-blue-600">{place}</Text>
                    <View 
                      className="ml-1 p-1"
                      onClick={() => handleRemoveMeetupPlace(index)}
                    >
                      <X size={12} color="#6B7280" />
                    </View>
                  </View>
                ))}
              </View>
              <View className="flex gap-2">
                <Input
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={voteSetting.meetupInput}
                  onInput={(e: any) => setVoteSetting(prev => ({ ...prev, meetupInput: e.detail.value }))}
                  onConfirm={handleAddMeetupPlace}
                  placeholder="输入地点后回车添加"
                />
                <UIButton size="sm" onClick={handleAddMeetupPlace}>
                  <Plus size={16} color="#fff" />
                </UIButton>
              </View>
            </View>

            {/* 投票截止时间 */}
            <View className="mb-4">
              <Text className="block text-sm font-medium text-gray-700 mb-2">投票截止时间</Text>
              <Input
                type="datetime-local"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={voteSetting.voteDeadline}
                onInput={(e: any) => setVoteSetting(prev => ({ ...prev, voteDeadline: e.detail.value }))}
              />
              <Text className="block text-xs text-gray-400 mt-1">截止时间到达后，未投票者视为弃权</Text>
            </View>

            {/* 确认按钮 */}
            <UIButton
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium"
              onClick={handleConfirmVote}
            >
              <Text className="text-white">创建投票</Text>
            </UIButton>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}
