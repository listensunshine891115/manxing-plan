import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { 
  MessageCircle, Check, 
  Sparkles, MapPin, ChevronRight, 
  CalendarDays, ArrowLeft, Share2, Clock, Users
} from 'lucide-react-taro'
import './preview.css'

// 行程概览数据类型
interface TripDay {
  day: number
  date: string
  items: Array<{
    id: string
    title: string
    image: string
    location: { name: string; lat: number; lng: number }
    type: string
    startTime: string
    duration: number
  }>
}

interface SavedTrip {
  itinerary: TripDay[]
  settings: {
    startDate: string
    days: number
    meetingPoint?: string
    meetingCoords?: { lat: number; lng: number }
    meetingSource?: 'none' | 'text' | 'map'
    startTime?: string
    endTime?: string
  }
}

// 模拟灵感数据
interface Inspiration {
  id: string
  title: string
  type: 'spot' | 'food' | 'show' | 'hotel'
  source: string
  time: string
  selected: boolean
}

const typeConfig = {
  spot: { icon: '🏛️', label: '景点' },
  food: { icon: '🍜', label: '美食' },
  show: { icon: '🎭', label: '演出' },
  hotel: { icon: '🏨', label: '住宿' }
}

export default function Preview() {
  // 行程概览状态
  const [savedTrip, setSavedTrip] = useState<SavedTrip | null>(null)
  
  // 灵感库
  const [inspirations, setInspirations] = useState<Inspiration[]>([
    { id: '1', title: '上海外滩夜景攻略', type: 'spot', source: '小红书', time: '今天', selected: false },
    { id: '2', title: '杭州西湖十景打卡', type: 'spot', source: '小红书', time: '昨天', selected: false },
    { id: '3', title: '杭州必吃美食清单', type: 'food', source: '大众点评', time: '昨天', selected: false },
    { id: '4', title: '周杰伦演唱会上海站', type: 'show', source: '大麦', time: '3天前', selected: false },
  ])

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
      const result = await Taro.getStorage({ key: 'savedTrip' })
      if (result.data) {
        setSavedTrip(result.data as SavedTrip)
      }
    } catch (error) {
      console.error('加载保存的行程失败:', error)
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

  // 切换灵感选中
  const toggleInspiration = (id: string) => {
    setInspirations(prev => prev.map(i => 
      i.id === id ? { ...i, selected: !i.selected } : i
    ))
  }

  // 如果有保存的行程，显示行程概览
  if (savedTrip) {
    return (
      <View className="preview-container">
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
        <View className="px-4 py-4">
          <View className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
            <View className="flex items-center mb-2">
              <CalendarDays size={18} color="#ffffff" />
              <Text className="block text-lg font-semibold ml-2">
                {savedTrip.settings.startDate}
                {savedTrip.settings.days > 1 && ` · 共${savedTrip.settings.days}天`}
              </Text>
            </View>
            {savedTrip.settings.startTime && (
              <View className="flex items-center">
                <Clock size={16} color="#ffffff" />
                <Text className="block text-sm ml-2 opacity-90">
                  出发: {savedTrip.settings.startTime}
                  {savedTrip.settings.endTime && ` · 返程: ${savedTrip.settings.endTime}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 集合地点 */}
        {savedTrip.settings.meetingPoint && (
          <View className="px-4 pb-4">
            <View className="bg-green-50 rounded-xl p-3 border border-green-200">
              <View className="flex items-center">
                <Users size={16} color="#10b981" />
                <Text className="block text-sm text-green-700 ml-2 flex-1">
                  集合地点: {savedTrip.settings.meetingPoint}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 每日行程 */}
        <View className="px-4 pb-24">
          <Text className="block text-sm font-medium text-gray-600 mb-3">行程安排</Text>
          {savedTrip.itinerary.map((day) => (
            <View key={day.day} className="mb-4">
              <View className="flex items-center mb-2">
                <View className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <Text className="block text-xs text-white font-medium">{day.day}</Text>
                </View>
                <Text className="block text-sm font-medium text-gray-800 ml-2">
                  第{day.day}天 · {day.date}
                </Text>
              </View>
              <View className="ml-3 pl-4 border-l-2 border-blue-200">
                {day.items.map((item, index) => (
                  <View key={item.id || index} className="py-2">
                    <View className="flex items-start">
                      <View className="w-2 h-2 rounded-full bg-blue-400 mt-2" />
                      <View className="ml-3 flex-1">
                        <Text className="block text-sm text-gray-800">{item.title}</Text>
                        <View className="flex items-center mt-1">
                          <Clock size={12} color="#9ca3af" />
                          <Text className="block text-xs text-gray-400 ml-1">
                            {item.startTime} · {item.duration}小时
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

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

  // 默认显示灵感库页面
  return (
    <View className="preview-container">
      {/* 品牌标识 */}
      <View className="brand-header">
        <View className="flex items-center gap-2">
          <Sparkles size={20} color="#3b82f6" />
          <Text className="block text-lg font-semibold">此刻与你漫行</Text>
        </View>
      </View>

      {/* 快捷操作 */}
      <View className="quick-actions">
        <View className="quick-action">
          <MapPin size={20} color="#3b82f6" />
          <Text>出行设置</Text>
        </View>
        <View className="quick-action">
          <Sparkles size={20} color="#f59e0b" />
          <Text>灵感管理</Text>
        </View>
      </View>

      {/* 提示 */}
      <View className="tip-card">
        <MessageCircle size={14} color="#10b981" />
        <Text>发送分享链接给公众号即可自动收录</Text>
      </View>

      {/* 灵感列表 */}
      <View className="inspiration-list">
        {(['spot', 'food', 'show', 'hotel'] as const).map(type => {
          const items = inspirations.filter(i => i.type === type)
          if (items.length === 0) return null
          const config = typeConfig[type]
          
          return (
            <View key={type} className="inspiration-group">
              <View className="type-header">
                <Text className="block">{config.icon} {config.label}</Text>
              </View>
              {items.map(item => (
                <View 
                  key={item.id}
                  className={`inspiration-item ${item.selected ? 'selected' : ''}`}
                  onClick={() => toggleInspiration(item.id)}
                >
                  <View className="item-checkbox">
                    {item.selected && <Check size={12} color="#fff" />}
                  </View>
                  <View className="item-content">
                    <Text className="block text-sm">{item.title}</Text>
                    <Text className="block text-xs text-gray-400 mt-1">
                      {item.source} · {item.time}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )
        })}
      </View>

      {/* 底部按钮 */}
      <View className="bottom-bar">
        <View className="selected-info">
          <Text>已选 {inspirations.filter(i => i.selected).length} 项</Text>
        </View>
        <Button className="plan-btn">
          <Text className="text-white">开始规划路线</Text>
          <ChevronRight size={16} color="#fff" />
        </Button>
      </View>
    </View>
  )
}
