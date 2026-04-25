import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CalendarDays, MapPin, Loader, Users, Clock, Car, Bus, CalendarCheck, Share2 } from 'lucide-react-taro'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
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
    // 集合地点信息
    meetingPoint?: string
    meetingCoords?: { lat: number; lng: number }
    meetingSource?: 'none' | 'text' | 'map'
    startTime?: string
    endTime?: string
    transportMode?: 'public' | 'self-drive'
    // 投票截止时间
    voteDeadline?: string
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
  // 是否需要同伴投票弹窗
  const [showVoteChoice, setShowVoteChoice] = useState(false)

  useEffect(() => {
    loadRoutePlan()
  }, [])

  // 配置分享给好友（行程概览）
  useShareAppMessage(() => {
    return {
      title: routePlan ? `${routePlan.settings.startDate}旅行行程` : '我的旅行行程',
      path: '/pages/preview/index',
      imageUrl: ''
    }
  })

  // 配置分享到朋友圈
  useShareTimeline(() => {
    return {
      title: routePlan ? `${routePlan.settings.startDate}旅行行程` : '我的旅行行程',
      imageUrl: ''
    }
  })

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

  // 保存行程并跳转到行程概览页面（不需要投票）
  const handleSaveToOverview = async () => {
    if (!routePlan) return

    setConfirming(true)
    try {
      // 获取用户信息
      const userInfo = Taro.getStorageSync('userInfo')
      const userId = userInfo?.id

      // 调用后端 API 保存行程
      const res = await Network.request({
        url: '/api/trip/trips',
        method: 'POST',
        data: {
          version_name: `行程-${routePlan.settings.startDate}`,
          content: [{
            itinerary: routePlan.itinerary,
            route: routePlan.route,
            statistics: routePlan.statistics
          }],
          settings: {
            start_date: routePlan.settings.startDate,
            days: routePlan.settings.days,
            mainDestination: routePlan.settings.mainDestination
          },
          user_id: userId
        }
      })

      console.log('[POST] /api/trip/trips - Response:', res.data)

      if (res.data && res.data.code === 200) {
        const tripId = res.data.data?.id
        
        // 保存到本地存储，供行程概览页面使用
        await Taro.setStorage({ key: 'savedTrip', data: routePlan })
        await Taro.setStorage({ key: 'currentTripId', data: tripId })

        Taro.showToast({ title: '保存成功', icon: 'success' })
        
        // 延迟跳转，让用户看到成功提示，然后跳转到行程概览页面
        setTimeout(() => {
          Taro.navigateTo({ url: '/pages/preview/index' })
        }, 1500)
      } else {
        throw new Error(res.data?.msg || '保存失败')
      }
    } catch (error: any) {
      console.error('保存行程失败:', error)
      Taro.showToast({ title: error.message || '保存失败，请重试', icon: 'none' })
      setConfirming(false)
    }
  }

  // 确认并创建投票（需要投票）
  const handleConfirmVote = async () => {
    if (!routePlan) return

    setConfirming(true)
    try {
      // 获取用户信息
      const userInfo = Taro.getStorageSync('userInfo')
      const userId = userInfo?.id
      const userName = userInfo?.nickname || userInfo?.name || '匿名用户'

      // 调用后端 API 保存行程
      const res = await Network.request({
        url: '/api/trip/trips',
        method: 'POST',
        data: {
          version_name: `行程-${routePlan.settings.startDate}`,
          content: [{
            itinerary: routePlan.itinerary,
            route: routePlan.route,
            statistics: routePlan.statistics
          }],
          settings: {
            start_date: routePlan.settings.startDate,
            days: routePlan.settings.days,
            mainDestination: routePlan.settings.mainDestination
          },
          user_id: userId
        }
      })

      console.log('[POST] /api/trip/trips - Response:', res.data)

      if (res.data && res.data.code === 200) {
        const tripId = res.data.data?.id
        
        // 构建集合地点标签数组
        const meetupPlaces: string[] = []
        if (routePlan.settings.meetingPoint) {
          if (routePlan.settings.meetingCoords) {
            // 有坐标的地点标签：名称|lat|lng
            meetupPlaces.push(`${routePlan.settings.meetingPoint}|${routePlan.settings.meetingCoords.lat}|${routePlan.settings.meetingCoords.lng}`)
          } else {
            // 无坐标的地点标签：仅名称
            meetupPlaces.push(routePlan.settings.meetingPoint)
          }
        }

        // 创建投票会话
        const inspirationPoints = routePlan.itinerary.flatMap(day => 
          day.items.map(item => ({
            id: item.inspirationId || item.id,
            title: item.title,
            image: item.image,
            location: item.location?.name ? { name: item.location.name } : undefined,
            type: item.type
          }))
        )

        const voteRes = await Network.request({
          url: '/api/vote/sessions',
          method: 'POST',
          data: {
            tripId: tripId,
            title: `旅行投票-${routePlan.settings.startDate}`,
            creatorName: userName,
            inspirationPoints: inspirationPoints,
            startDate: routePlan.settings.startDate,
            endDate: routePlan.settings.days > 1 ? routePlan.settings.startDate : undefined,
            meetupPlace: meetupPlaces.length > 0 ? meetupPlaces : undefined,
            voteDeadline: routePlan.settings.voteDeadline
          }
        })

        console.log('[POST] /api/vote/sessions - Response:', voteRes.data)

        if (voteRes.data && voteRes.data.code === 200) {
          const shareCode = voteRes.data.data?.shareCode
          
          Taro.showToast({ title: '保存成功', icon: 'success' })
          
          // 延迟跳转，让用户看到成功提示，然后跳转到投票页面
          setTimeout(() => {
            Taro.navigateTo({ url: `/pages/vote/index?code=${shareCode}` })
          }, 1500)
        } else {
          throw new Error(voteRes.data?.msg || '创建投票会话失败')
        }
      } else {
        throw new Error(res.data?.msg || '保存失败')
      }
    } catch (error: any) {
      console.error('确认行程失败:', error)
      Taro.showToast({ title: error.message || '保存失败，请重试', icon: 'none' })
      setConfirming(false)
    }
  }

  // 确认按钮点击 - 显示选择弹窗
  const handleConfirm = () => {
    setShowVoteChoice(true)
  }

  // 用户选择需要投票
  const handleChooseVote = () => {
    setShowVoteChoice(false)
    handleConfirmVote()
  }

  // 用户选择不需要投票
  const handleChooseNoVote = () => {
    setShowVoteChoice(false)
    handleSaveToOverview()
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

          {/* 出发时间 */}
          {routePlan.settings.startTime && (
            <View className="flex items-center mt-2">
              <Clock size={16} color="#64748b" />
              <Text className="block text-sm text-gray-600 ml-2">
                出发时间: {routePlan.settings.startTime}
                {routePlan.settings.endTime && ` - 返程: ${routePlan.settings.endTime}`}
              </Text>
            </View>
          )}

          {/* 交通方式 */}
          {routePlan.settings.transportMode && (
            <View className="flex items-center mt-2">
              {routePlan.settings.transportMode === 'public' ? (
                <Bus size={16} color="#64748b" />
              ) : (
                <Car size={16} color="#64748b" />
              )}
              <Text className="block text-sm text-gray-600 ml-2">
                交通方式: {routePlan.settings.transportMode === 'public' ? '公共交通' : '自驾'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 集合地点 */}
      {routePlan.settings.meetingPoint && (
        <View className="px-4 py-2">
          <View className="bg-green-50 rounded-2xl p-4 border border-green-200">
            <View className="flex items-center mb-2">
              <Users size={18} color="#10b981" />
              <Text className="block text-base font-medium text-green-700 ml-2">集合地点</Text>
              {routePlan.settings.meetingSource === 'map' && (
                <View className="ml-2 px-2 py-1 rounded text-xs text-blue-600 bg-blue-50 border border-blue-200">
                  已定位
                </View>
              )}
              {routePlan.settings.meetingSource === 'text' && (
                <View className="ml-2 px-2 py-1 rounded text-xs text-gray-600 bg-gray-100 border border-gray-200">
                  文字
                </View>
              )}
            </View>
            <View className="flex items-center">
              <MapPin size={16} color="#10b981" />
              <Text className="block text-sm text-green-700 ml-2 flex-1">
                {routePlan.settings.meetingPoint}
              </Text>
            </View>
            {routePlan.settings.meetingCoords && (
              <Text className="block text-xs text-gray-500 mt-1 ml-6">
                坐标: ({routePlan.settings.meetingCoords.lat.toFixed(4)}, {routePlan.settings.meetingCoords.lng.toFixed(4)})
              </Text>
            )}
          </View>
        </View>
      )}

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
              <Text className="text-white">保存中...</Text>
            </>
          ) : (
            <>
              <CalendarCheck size={18} color="#ffffff" className="mr-2" />
              <Text className="text-white">确认并继续</Text>
            </>
          )}
        </Button>
      </View>

      {/* 是否需要同伴投票选择弹窗 */}
      {showVoteChoice && (
        <View 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={() => setShowVoteChoice(false)}
        >
          <View 
            style={{
              width: '80%', maxWidth: '320px',
              backgroundColor: '#fff', borderRadius: '16px',
              padding: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Text className="block text-lg font-semibold text-gray-900 text-center mb-2">
              是否需要同伴投票？
            </Text>
            <Text className="block text-sm text-gray-500 text-center mb-6">
              选择后行程将被保存并生成分享链接
            </Text>
            
            {/* 需要投票 */}
            <View 
              style={{
                padding: '16px', borderRadius: '12px',
                border: '1px solid #3b82f6', backgroundColor: '#eff6ff',
                marginBottom: '12px'
              }}
              onClick={handleChooseVote}
            >
              <View className="flex items-center">
                <Users size={20} color="#3b82f6" />
                <View className="ml-3 flex-1">
                  <Text className="block text-base font-medium text-blue-600">需要同伴投票</Text>
                  <Text className="block text-xs text-gray-500 mt-1">
                    邀请好友对行程景点投票，共同决定最终路线
                  </Text>
                </View>
              </View>
            </View>
            
            {/* 不需要投票 */}
            <View 
              style={{
                padding: '16px', borderRadius: '12px',
                border: '1px solid #10b981', backgroundColor: '#f0fdf4',
                marginBottom: '12px'
              }}
              onClick={handleChooseNoVote}
            >
              <View className="flex items-center">
                <Share2 size={20} color="#10b981" />
                <View className="ml-3 flex-1">
                  <Text className="block text-base font-medium text-green-600">不需要投票</Text>
                  <Text className="block text-xs text-gray-500 mt-1">
                    直接生成行程概览，分享给朋友查看
                  </Text>
                </View>
              </View>
            </View>
            
            <Button 
              variant="outline" 
              className="w-full mt-2"
              onClick={() => setShowVoteChoice(false)}
            >
              取消
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
