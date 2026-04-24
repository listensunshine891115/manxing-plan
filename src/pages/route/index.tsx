import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, Share2, ChevronUp, ChevronDown, MapPin, Clock, 
  Navigation, Sparkles, Route as RouteIcon, Circle
} from 'lucide-react-taro'
import Taro from '@tarojs/taro'
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

  const handleShareVote = () => {
    Taro.showToast({ title: '分享功能开发中', icon: 'none' })
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
          <Button onClick={handleRegenerate}>
            <Sparkles size={16} color="#fff" />
            <Text className="text-white ml-2">重新规划</Text>
          </Button>
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
            <Button variant="ghost" size="icon" onClick={() => Taro.navigateBack()}>
              <ArrowLeft size={24} color="#1E293B" />
            </Button>
            <Text className="block text-lg font-semibold text-foreground ml-2">路线方案</Text>
          </View>
          <Button variant="ghost" size="icon">
            <Share2 size={20} color="#3B82F6" />
          </Button>
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
                          <View className="flex items-center gap-2 mb-1">
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
                        </View>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <Navigation size={18} color="#3B82F6" />
                        </Button>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* 底部操作栏 */}
      <View 
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff', borderTop: '1px solid #e5e5e5',
          padding: '16px', paddingBottom: '32px', zIndex: 100
        }}
      >
        <View className="flex gap-3 mb-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={handleShareVote}
          >
            <Share2 size={18} color="#3B82F6" className="mr-2" />
            <Text>分享投票</Text>
          </Button>
          <Button
            className="flex-1 h-12 text-base font-medium"
            onClick={handleConfirm}
          >
            <Circle size={18} color="#fff" className="mr-2" />
            <Text className="text-white">确认行程</Text>
          </Button>
        </View>
        <Button
          variant="ghost"
          className="w-full h-10 text-gray-500"
          onClick={handleRegenerate}
        >
          <RouteIcon size={16} color="#64748B" className="mr-2" />
          <Text className="text-gray-500">重新规划</Text>
        </Button>
      </View>
    </View>
  )
}
