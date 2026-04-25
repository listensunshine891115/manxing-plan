import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { 
  MapPin, 
  CalendarDays, ArrowLeft, Share2, Clock, Users
} from 'lucide-react-taro'
import './preview.css'

// 类型配置
const typeConfig: Record<string, { emoji: string; label: string; color: string }> = {
  spot: { emoji: '🏛️', label: '景点', color: 'blue' },
  food: { emoji: '🍜', label: '美食', color: 'orange' },
  show: { emoji: '🎭', label: '演出', color: 'purple' },
  hotel: { emoji: '🏨', label: '住宿', color: 'green' },
  transport: { emoji: '🚗', label: '交通', color: 'gray' },
  default: { emoji: '📍', label: '地点', color: 'gray' }
}

// 行程概览数据类型
interface TripItem {
  id: string
  title: string
  image?: string
  location?: { name: string; lat: number; lng: number }
  type: string
  startTime: string
  duration: number
  distance?: number
  inspirationId?: string
}

interface TripDay {
  day: number
  date: string
  items: TripItem[]
}

interface SavedTrip {
  itinerary: TripDay[]
  route?: Array<{
    id: string
    title: string
    location?: { name: string }
    type: string
  }>
  statistics?: {
    totalPoints: number
    locatedPoints: number
    totalDistance: number
  }
  settings: {
    startDate: string
    days: number
    meetingPoint?: string
    meetingCoords?: { lat: number; lng: number }
    meetingSource?: 'none' | 'text' | 'map'
    startTime?: string
    endTime?: string
    transportMode?: 'public' | 'self-drive'
    mainDestination?: string
  }
}

export default function Preview() {
  // 行程概览状态
  const [savedTrip, setSavedTrip] = useState<SavedTrip | null>(null)

  // 加载保存的行程
  useEffect(() => {
    loadSavedTrip()
  }, [])

  // 配置分享
  useShareAppMessage(() => {
    return {
      title: savedTrip ? `${savedTrip.settings.startDate}旅行行程` : '我的旅行行程',
      path: '/pages/preview/index',
      imageUrl: ''
    }
  })

  useShareTimeline(() => {
    return {
      title: savedTrip ? `${savedTrip.settings.startDate}旅行行程` : '我的旅行行程',
      imageUrl: ''
    }
  })

  const loadSavedTrip = async () => {
    try {
      // 尝试加载已保存的行程
      const result = await Taro.getStorage({ key: 'savedTrip' })
      if (result.data) {
        setSavedTrip(result.data as SavedTrip)
      }
    } catch (error) {
      console.error('加载保存的行程失败:', error)
      // 如果没有保存的行程，使用模拟数据展示
      setSavedTrip({
        itinerary: [],
        settings: {
          startDate: new Date().toISOString().split('T')[0],
          days: 1
        }
      })
    }
  }

  const handleShare = () => {
    Taro.showShareMenu({
      withShareTicket: true
    })
  }

  const handleBackToHome = () => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  // 如果有保存的行程，显示行程概览
  if (savedTrip) {
    const totalDays = savedTrip.itinerary?.length || 0
    const totalPlaces = savedTrip.itinerary?.reduce((sum, day) => sum + day.items.length, 0) || 0
    const totalDistance = savedTrip.statistics?.totalDistance || 0

    return (
      <View className="min-h-screen bg-gray-50 pb-24">
        {/* 头部 */}
        <View className="bg-white px-4 py-4 sticky top-0 z-10 shadow-sm">
          <View className="flex items-center justify-between">
            <View 
              className="flex items-center gap-2"
              onClick={handleBackToHome}
            >
              <ArrowLeft size={20} color="#374151" />
              <Text className="block text-lg font-semibold text-gray-800">行程概览</Text>
            </View>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
            >
              <Share2 size={20} color="#3B82F6" />
            </Button>
          </View>
        </View>

        {/* 行程信息卡片 */}
        <View className="px-4 py-5">
          <View className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
            <Text className="block text-xl font-semibold mb-3">{savedTrip.settings.mainDestination || '旅行行程'}</Text>
            
            <View className="flex justify-around mb-3 pb-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' }}>
              <View className="text-center">
                <Text className="block text-2xl font-bold">{totalDays}</Text>
                <Text className="block text-xs mt-1" style={{ opacity: 0.8 }}>天</Text>
              </View>
              <View className="text-center">
                <Text className="block text-2xl font-bold">{totalPlaces}</Text>
                <Text className="block text-xs mt-1" style={{ opacity: 0.8 }}>个地点</Text>
              </View>
              <View className="text-center">
                <Text className="block text-2xl font-bold">
                  {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)}` : '-'}
                </Text>
                <Text className="block text-xs mt-1" style={{ opacity: 0.8 }}>公里</Text>
              </View>
            </View>

            <View className="flex items-center mb-2">
              <CalendarDays size={16} color="#ffffff" />
              <Text className="block text-sm ml-2" style={{ opacity: 0.9 }}>
                {savedTrip.settings.startDate}
                {totalDays > 1 && ` · 共${totalDays}天`}
              </Text>
            </View>
            
            {savedTrip.settings.startTime && (
              <View className="flex items-center">
                <Clock size={16} color="#ffffff" />
                <Text className="block text-sm ml-2" style={{ opacity: 0.9 }}>
                  {savedTrip.settings.startTime}
                  {savedTrip.settings.endTime && ` - ${savedTrip.settings.endTime}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 集合地点 */}
        {savedTrip.settings.meetingPoint && (
          <View className="px-4 pb-4">
            <View className="bg-green-50 rounded-xl p-4 border border-green-200">
              <View className="flex items-center mb-2">
                <Users size={18} color="#10b981" />
                <Text className="block text-base font-medium text-green-700 ml-2">集合地点</Text>
                {savedTrip.settings.meetingSource === 'map' && (
                  <View className="ml-2 px-2 py-1 rounded text-xs text-blue-600 bg-blue-50 border border-blue-200">
                    已定位
                  </View>
                )}
                {savedTrip.settings.meetingSource === 'text' && (
                  <View className="ml-2 px-2 py-1 rounded text-xs text-gray-600 bg-gray-100 border border-gray-200">
                    文字
                  </View>
                )}
              </View>
              <View className="flex items-center">
                <MapPin size={16} color="#10b981" />
                <Text className="block text-sm text-green-700 ml-2 flex-1">
                  {savedTrip.settings.meetingPoint}
                </Text>
              </View>
              {savedTrip.settings.meetingCoords && (
                <Text className="block text-xs text-gray-500 mt-1 ml-6">
                  坐标: ({savedTrip.settings.meetingCoords.lat.toFixed(4)}, {savedTrip.settings.meetingCoords.lng.toFixed(4)})
                </Text>
              )}
            </View>
          </View>
        )}

        {/* 每日行程清单 - 遵循生成路线的规则 */}
        <View className="px-4 space-y-4">
          {savedTrip.itinerary?.map((day) => (
            <View key={day.day} className="bg-white rounded-2xl p-4 shadow-sm">
              <View className="flex items-center mb-4">
                <View className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <Text className="block text-sm font-medium text-white">D{day.day}</Text>
                </View>
                <Text className="block text-sm font-medium text-gray-900 ml-2">{day.date}</Text>
                <Text className="block text-xs text-gray-400 ml-auto">{day.items.length}个地点</Text>
              </View>

              <View className="space-y-2">
                {day.items.map((item, itemIndex) => {
                  const itemType = typeConfig[item.type] || typeConfig.default
                  return (
                    <View key={item.id} className="flex items-start">
                      {/* 时间线 */}
                      <View className="flex flex-col items-center">
                        <View className="w-2 h-2 rounded-full bg-blue-500" />
                        {itemIndex < day.items.length - 1 && (
                          <View className="w-1 h-8 bg-gray-200 mt-1" />
                        )}
                      </View>
                      
                      {/* 内容 */}
                      <View className="flex-1 ml-3 pb-3">
                        <View className="flex items-center">
                          <Text className="block text-sm mr-2">{itemType.emoji}</Text>
                          <Text className="block text-sm font-medium text-gray-900 flex-1">
                            {item.title}
                          </Text>
                          <Text className="block text-xs text-gray-400">{item.startTime}</Text>
                        </View>
                        {item.location?.name && (
                          <View className="flex items-center mt-1 ml-5">
                            <MapPin size={12} color="#9ca3af" />
                            <Text className="block text-xs text-gray-500 ml-1 truncate max-w-48">
                              {item.location.name}
                            </Text>
                          </View>
                        )}
                        {item.distance && itemIndex < day.items.length - 1 && (
                          <Text className="block text-xs text-gray-400 ml-5 mt-1">
                            距下站 {item.distance > 1000 ? `${(item.distance / 1000).toFixed(1)}km` : `${item.distance}m`}
                          </Text>
                        )}
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          ))}
        </View>

        {/* 空状态提示 */}
        {!savedTrip.itinerary?.length && (
          <View className="px-4 py-8 text-center">
            <Text className="block text-gray-400">暂无行程数据</Text>
            <Button 
              className="mt-4"
              onClick={handleBackToHome}
            >
              返回首页
            </Button>
          </View>
        )}

        {/* 底部分享按钮 */}
        <View 
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: '#fff', borderTop: '1px solid #e5e5e5',
            padding: '16px', paddingBottom: '32px', zIndex: 100
          }}
        >
          <Button
            className="w-full py-3 rounded-xl bg-green-500 text-white font-medium"
            onClick={handleShare}
          >
            <Share2 size={18} color="#ffffff" className="mr-2" />
            <Text className="text-white">分享行程给朋友</Text>
          </Button>
        </View>
      </View>
    )
  }

  // 加载中状态
  return (
    <View className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Text className="block text-gray-400">加载中...</Text>
    </View>
  )
}
