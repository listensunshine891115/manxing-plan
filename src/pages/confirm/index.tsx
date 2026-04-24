import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Check, CalendarDays, MapPin, Loader } from 'lucide-react-taro'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
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

// 类型配置
const typeConfig: Record<string, { color: string; emoji: string }> = {
  food: { color: '#F59E0B', emoji: '🍜' },
  shopping: { color: '#EC4899', emoji: '🛍️' },
  activity: { color: '#8B5CF6', emoji: '🏛️' },
  spot: { color: '#3B82F6', emoji: '📍' }
}

export default function Confirm() {
  const [routePlan, setRoutePlan] = useState<RoutePlanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    loadRoutePlan()
  }, [])

  const loadRoutePlan = async () => {
    try {
      const result = await Taro.getStorage({ key: 'routePlanResult' })
      console.log('[Confirm] 从缓存获取路线规划结果:', result.data)

      if (result.data) {
        setRoutePlan(result.data as RoutePlanResult)
      }
    } catch (error) {
      console.error('加载路线规划结果失败:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 确认行程
  const handleConfirm = async () => {
    if (!routePlan) return

    setConfirming(true)
    try {
      // 调用后端 API 保存行程
      const res = await Network.request({
        url: '/api/trip/trips',
        method: 'POST',
        data: {
          name: `行程-${routePlan.settings.startDate}`,
          content: {
            itinerary: routePlan.itinerary,
            route: routePlan.route,
            statistics: routePlan.statistics
          },
          settings: {
            days: routePlan.settings.days,
            startDate: routePlan.settings.startDate,
            mainDestination: routePlan.settings.mainDestination
          }
        }
      })

      console.log('[POST] /api/trip/trips - Response:', res.data)

      if (res.data && res.data.code === 200) {
        // 清除缓存
        await Taro.removeStorage({ key: 'routePlanResult' })
        
        Taro.showToast({ title: '保存成功', icon: 'success' })
        
        // 延迟跳转，让用户看到成功提示
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/preview/index' })
        }, 1500)
      } else {
        throw new Error(res.data?.msg || '保存失败')
      }
    } catch (error: any) {
      console.error('确认行程失败:', error)
      Taro.showToast({ title: error.message || '保存失败，请重试', icon: 'none' })
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <View className="text-center">
          <Loader size={32} color="#3b82f6" className="animate-spin mx-auto" />
          <Text className="block text-sm text-gray-500 mt-2">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!routePlan) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <View className="text-center px-4">
          <Text className="block text-gray-500">路线数据加载失败</Text>
          <Button className="mt-4" onClick={() => Taro.navigateBack()}>
            返回
          </Button>
        </View>
      </View>
    )
  }

  // 计算总览信息
  const totalDays = routePlan.itinerary.length
  const totalPlaces = routePlan.itinerary.reduce((sum, day) => sum + day.items.length, 0)
  const totalDistance = routePlan.statistics.totalDistance

  return (
    <View className="min-h-screen bg-gray-50 pb-32">
      {/* 顶部导航 */}
      <View className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <View className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={24} color="#1E293B" />
          </Button>
          <Text className="block text-lg font-semibold text-gray-900 ml-2">确认行程</Text>
        </View>
      </View>

      {/* 行程概览 */}
      <View className="px-4 py-5">
        <View className="bg-white rounded-2xl p-5 shadow-sm">
          <Text className="block text-lg font-semibold text-gray-900 mb-4">行程概览</Text>
          
          <View className="flex justify-around mb-4 pb-4 border-b border-gray-100">
            <View className="text-center">
              <Text className="block text-2xl font-bold text-blue-500">{totalDays}</Text>
              <Text className="block text-xs text-gray-500 mt-1">天</Text>
            </View>
            <View className="text-center">
              <Text className="block text-2xl font-bold text-blue-500">{totalPlaces}</Text>
              <Text className="block text-xs text-gray-500 mt-1">个地点</Text>
            </View>
            <View className="text-center">
              <Text className="block text-2xl font-bold text-blue-500">
                {totalDistance > 0 ? `${(totalDistance / 1000).toFixed(1)}` : '-'}
              </Text>
              <Text className="block text-xs text-gray-500 mt-1">公里</Text>
            </View>
          </View>

          {/* 日期范围 */}
          <View className="flex items-center">
            <CalendarDays size={16} color="#64748b" />
            <Text className="block text-sm text-gray-600 ml-2">
              {routePlan.settings.startDate}
              {totalDays > 1 && ` - 共${totalDays}天`}
            </Text>
          </View>
        </View>
      </View>

      {/* 每日行程预览 */}
      <View className="px-4 space-y-4">
        {routePlan.itinerary.map((day) => (
          <View key={day.day} className="bg-white rounded-2xl p-4 shadow-sm">
            <View className="flex items-center mb-3">
              <View className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <Text className="block text-sm font-medium text-white">D{day.day}</Text>
              </View>
              <Text className="block text-sm font-medium text-gray-900 ml-2">{day.date}</Text>
              <Text className="block text-xs text-gray-400 ml-auto">{day.items.length}个地点</Text>
            </View>

            <View className="space-y-2">
              {day.items.map((item, itemIndex) => {
                const typeStyle = typeConfig[item.type] || typeConfig.spot
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
                        <Text className="block text-sm mr-2">{typeStyle.emoji}</Text>
                        <Text className="block text-sm font-medium text-gray-900 flex-1">
                          {item.title}
                        </Text>
                        <Text className="block text-xs text-gray-400">{item.startTime}</Text>
                      </View>
                      <View className="flex items-center mt-1 ml-5">
                        <MapPin size={12} color="#9ca3af" />
                        <Text className="block text-xs text-gray-500 ml-1 truncate max-w-48">
                          {item.location.name}
                        </Text>
                      </View>
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

      {/* 底部确认按钮 */}
      <View 
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff', borderTop: '1px solid #e5e5e5',
          padding: '16px', paddingBottom: '32px', zIndex: 100
        }}
      >
        <Button 
          className="w-full h-12 text-base font-medium bg-blue-500"
          onClick={handleConfirm}
          disabled={confirming}
        >
          {confirming ? (
            <>
              <Loader size={18} color="#ffffff" className="mr-2 animate-spin" />
              <Text className="text-white">确认中...</Text>
            </>
          ) : (
            <>
              <Check size={18} color="#ffffff" className="mr-2" />
              <Text className="text-white">确认行程</Text>
            </>
          )}
        </Button>
      </View>
    </View>
  )
}
