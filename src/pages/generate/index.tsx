import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, CalendarDays, Clock, Wallet, Car, Bus, Sparkles, MapPin, Users, ChevronRight, Loader } from 'lucide-react-taro'
import { format } from 'date-fns'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import './index.css'

// 出行需求选项
const demandOptions = [
  { value: 'relax', label: '休闲放松', icon: '🧘', desc: '慢节奏，重体验' },
  { value: 'adventure', label: '探索冒险', icon: '🏔️', desc: '多打卡，重发现' },
  { value: 'food', label: '美食之旅', icon: '🍜', desc: '吃遍当地美味' },
  { value: 'culture', label: '文化沉浸', icon: '🏛️', desc: '博物馆、历史' }
]

// 灵感点类型
interface InspirationItem {
  id: string
  title: string
  image?: string
  type?: string
  location_name?: string
  location_lat?: number
  location_lng?: number
  rating?: number
  note?: string
}

// 路线规划结果类型
interface RoutePlanResult {
  route: Array<{
    id: string
    title: string
    image?: string
    type?: string
    location: { name: string; lat: number; lng: number }
    locationSource: 'original' | 'mock'
    distance?: number
  }>
  statistics: {
    totalPoints: number
    locatedPoints: number
    totalDistance: number
  }
  itinerary: Array<{
    day: number
    date: string
    items: Array<{
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
    }>
  }>
  settings: {
    days: number
    startDate: string
    mainDestination?: string
  }
}

export default function Generate() {
  // 出行设置
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [days, setDays] = useState(3)
  const [budget, setBudget] = useState<number>(0)
  const [transportMode, setTransportMode] = useState<'public' | 'self-drive'>('public')
  const [selectedDemand, setSelectedDemand] = useState<string>('relax')
  const [mainDestination, setMainDestination] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)

  // 选中的灵感点
  const [selectedInspirations, setSelectedInspirations] = useState<InspirationItem[]>([])
  const [loadingInspiration, setLoadingInspiration] = useState(false)

  // 生成状态
  const [generating, setGenerating] = useState(false)

  // 获取 URL 参数
  useEffect(() => {
    const router = Taro.getCurrentInstance().router
    if (router) {
      const params = router.params
      console.log('[Generate] URL params:', params)

      // 获取选中的灵感点 ID
      if (params.selected) {
        const ids = params.selected.split(',')
        fetchSelectedInspirations(ids)
      }
    }
  }, [])

  // 获取选中的灵感点详情
  const fetchSelectedInspirations = async (ids: string[]) => {
    setLoadingInspiration(true)
    try {
      const inspirations: InspirationItem[] = []

      // 逐个获取灵感点详情
      for (const id of ids) {
        const res = await Network.request({
          url: `/api/trip/inspirations/${id}`
        })
        console.log(`[GET] /api/trip/inspirations/${id} - Response:`, res.data)

        if (res.data && res.data.data) {
          inspirations.push(res.data.data)
        }
      }

      setSelectedInspirations(inspirations)
      console.log('[Generate] 获取到的灵感点:', inspirations)
    } catch (error) {
      console.error('获取灵感点失败:', error)
      Taro.showToast({ title: '获取灵感点失败', icon: 'none' })
    } finally {
      setLoadingInspiration(false)
    }
  }

  // 生成路线
  const handleGenerate = async () => {
    if (selectedInspirations.length === 0) {
      Taro.showToast({ title: '请先选择灵感点', icon: 'none' })
      return
    }

    setGenerating(true)

    try {
      // 调用后端路线规划 API
      const inspirationsData = selectedInspirations.map(ins => ({
        id: ins.id,
        title: ins.title,
        image: ins.image,
        type: ins.type,
        location: (ins.location_lat && ins.location_lng)
          ? { name: ins.location_name || ins.title, lat: ins.location_lat, lng: ins.location_lng }
          : undefined,
        location_str: ins.location_name,
        rating: ins.rating,
        note: ins.note
      }))

      const res = await Network.request({
        url: '/api/trip/route/plan',
        method: 'POST',
        data: {
          inspirations: inspirationsData,
          mainDestination,
          days,
          startDate: format(startDate, 'yyyy-MM-dd')
        }
      })

      console.log('[POST] /api/trip/route/plan - Response:', res.data)

      // 检查响应
      if (res.data && res.data.code === 200 && res.data.data) {
        const result: RoutePlanResult = res.data.data

        // 将结果存储到全局或跳转时传递
        // 使用 Taro.setStorage 存储路线规划结果
        await Taro.setStorage({ key: 'routePlanResult', data: result })

        // 跳转到路线展示页
        Taro.navigateTo({ url: '/pages/route/index' })
      } else {
        throw new Error(res.data?.msg || '路线规划失败')
      }
    } catch (error) {
      console.error('生成路线失败:', error)
      Taro.showToast({ title: '生成路线失败，请重试', icon: 'none' })
      setGenerating(false)
    }
  }

  // 渲染日历
  const renderCalendar = () => {
    if (!showCalendar) return null
    
    return (
      <View className="calendar-overlay" onClick={() => setShowCalendar(false)}>
        <View className="calendar-container" onClick={e => e.stopPropagation()}>
          <Calendar
            mode="single"
            selected={startDate}
            onSelect={(date) => {
              if (date) {
                setStartDate(date)
                setShowCalendar(false)
              }
            }}
            disabled={(date) => date < new Date()}
          />
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background pb-28">
      {/* 顶部导航 */}
      <View className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <View className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft size={24} color="#1E293B" />
          </Button>
          <Text className="block text-lg font-semibold text-foreground ml-2">出行设置</Text>
        </View>
      </View>

      {/* 选中的灵感点预览 */}
      {selectedInspirations.length > 0 && (
        <View className="px-4 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
          <View className="flex items-center justify-between mb-3">
            <Text className="block text-sm font-medium text-blue-700">
              已选择 {selectedInspirations.length} 个灵感点
            </Text>
            <Text 
              className="block text-xs text-blue-500"
              onClick={() => Taro.navigateBack()}
            >
              返回修改
            </Text>
          </View>
          {loadingInspiration ? (
            <View className="flex items-center py-2">
              <Loader size={16} color="#3b82f6" className="animate-spin" />
              <Text className="block text-xs text-gray-500 ml-2">加载中...</Text>
            </View>
          ) : (
            <View className="flex flex-wrap gap-2">
              {selectedInspirations.slice(0, 6).map(ins => (
                <View 
                  key={ins.id}
                  className="px-3 py-2 bg-white rounded-full border border-blue-200 flex items-center"
                >
                  <Text className="block text-xs text-gray-700">
                    {ins.type === 'food' ? '🍜' : ins.type === 'shopping' ? '🛍️' : '🏛️'}
                  </Text>
                  <Text className="block text-xs text-gray-700 ml-1 max-w-24 truncate">
                    {ins.title}
                  </Text>
                </View>
              ))}
              {selectedInspirations.length > 6 && (
                <View className="px-3 py-2 bg-white rounded-full bg-opacity-50">
                  <Text className="block text-xs text-gray-500">
                    +{selectedInspirations.length - 6} 更多
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* 设置表单 */}
      <View className="px-4 py-5 space-y-5">
        
        {/* 出发日期 */}
        <View className="setting-card">
          <View className="setting-header">
            <CalendarDays size={18} color="#3B82F6" />
            <Text className="block text-sm font-medium text-foreground ml-2">出发日期</Text>
          </View>
          <Button 
            variant="outline" 
            className="w-full justify-start mt-3 h-11"
            onClick={() => setShowCalendar(true)}
          >
            <Text className="block text-sm text-foreground">
              {format(startDate, 'yyyy年MM月dd日')}（{days}天行程）
            </Text>
          </Button>
        </View>

        {/* 行程天数 */}
        <View className="setting-card">
          <View className="setting-header">
            <Clock size={18} color="#3B82F6" />
            <Text className="block text-sm font-medium text-foreground ml-2">行程天数</Text>
          </View>
          <View className="mt-3">
            <Slider
              value={[days]}
              onValueChange={(val) => setDays(val[0])}
              min={1}
              max={7}
              step={1}
            />
            <View className="flex justify-between mt-2">
              <Text className="block text-xs text-muted-foreground">1天</Text>
              <Text className="block font-semibold" style={{ color: '#3B82F6' }}>{days}天</Text>
              <Text className="block text-xs text-muted-foreground">7天</Text>
            </View>
          </View>
        </View>

        {/* 主要目的地 */}
        <View className="setting-card">
          <View className="setting-header">
            <MapPin size={18} color="#3B82F6" />
            <Text className="block text-sm font-medium text-foreground ml-2">主要目的地</Text>
          </View>
          <View className="mt-3 flex gap-2 flex-wrap">
            {['厦门', '杭州', '成都', '大理', '重庆', '西安'].map(city => (
              <View
                key={city}
                className="city-tag"
                onClick={() => setMainDestination(city)}
                style={{
                  backgroundColor: mainDestination === city ? '#EFF6FF' : '#F8FAFC',
                  borderColor: mainDestination === city ? '#3B82F6' : '#E2E8F0'
                }}
              >
                <Text 
                  className="block text-xs"
                  style={{ color: mainDestination === city ? '#3B82F6' : '#64748B' }}
                >
                  {city}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 出行需求 */}
        <View className="setting-card">
          <View className="setting-header">
            <Sparkles size={18} color="#3B82F6" />
            <Text className="block text-sm font-medium text-foreground ml-2">出行需求</Text>
          </View>
          <View className="mt-3 grid grid-cols-2 gap-2">
            {demandOptions.map(opt => (
              <View
                key={opt.value}
                className="demand-item"
                onClick={() => setSelectedDemand(opt.value)}
                style={{
                  backgroundColor: selectedDemand === opt.value ? '#EFF6FF' : '#F8FAFC',
                  borderColor: selectedDemand === opt.value ? '#3B82F6' : '#E2E8F0'
                }}
              >
                <Text className="block text-lg mb-1">{opt.icon}</Text>
                <Text 
                  className="block text-xs font-medium"
                  style={{ color: selectedDemand === opt.value ? '#3B82F6' : '#1E293B' }}
                >
                  {opt.label}
                </Text>
                <Text className="block text-xs text-muted-foreground mt-1">
                  {opt.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 预算范围 */}
        <View className="setting-card">
          <View className="setting-header">
            <Wallet size={18} color="#3B82F6" />
            <Text className="block text-sm font-medium text-foreground ml-2">预算范围</Text>
            <Text className="block text-xs text-muted-foreground ml-auto">可选</Text>
          </View>
          <View className="mt-3">
            <Slider
              value={[budget]}
              onValueChange={(val) => setBudget(val[0])}
              min={0}
              max={10000}
              step={500}
            />
            <View className="flex justify-between mt-2">
              <Text className="block text-xs text-muted-foreground">不限</Text>
              <Text className="block font-semibold" style={{ color: '#3B82F6' }}>
                {budget > 0 ? `¥${budget}` : '不限'}
              </Text>
              <Text className="block text-xs text-muted-foreground">¥10000</Text>
            </View>
          </View>
        </View>

        {/* 出行方式 */}
        <View className="setting-card">
          <View className="setting-header">
            {transportMode === 'public' ? (
              <Bus size={18} color="#3B82F6" />
            ) : (
              <Car size={18} color="#3B82F6" />
            )}
            <Text className="block text-sm font-medium text-foreground ml-2">出行方式</Text>
          </View>
          <RadioGroup 
            value={transportMode} 
            onValueChange={(val) => setTransportMode(val as 'public' | 'self-drive')}
            className="mt-3 space-y-2"
          >
            <View 
              className="transport-item"
              onClick={() => setTransportMode('public')}
              style={{
                backgroundColor: transportMode === 'public' ? '#EFF6FF' : '#F8FAFC',
                borderColor: transportMode === 'public' ? '#3B82F6' : '#E2E8F0'
              }}
            >
              <RadioGroupItem value="public" />
              <View className="flex items-center ml-2">
                <Bus size={16} color="#64748B" />
                <Text className="block text-sm text-foreground ml-2">公共交通</Text>
              </View>
            </View>
            <View 
              className="transport-item"
              onClick={() => setTransportMode('self-drive')}
              style={{
                backgroundColor: transportMode === 'self-drive' ? '#EFF6FF' : '#F8FAFC',
                borderColor: transportMode === 'self-drive' ? '#3B82F6' : '#E2E8F0'
              }}
            >
              <RadioGroupItem value="self-drive" />
              <View className="flex items-center ml-2">
                <Car size={16} color="#64748B" />
                <Text className="block text-sm text-foreground ml-2">自驾出行</Text>
              </View>
            </View>
          </RadioGroup>
        </View>

        {/* 协作选项 */}
        <View className="setting-card" style={{ backgroundColor: '#F8FAFC' }}>
          <View className="flex items-center justify-between">
            <View className="flex items-center">
              <Users size={18} color="#8B5CF6" />
              <View className="ml-2">
                <Text className="block text-sm font-medium text-foreground">邀请同伴协作</Text>
                <Text className="block text-xs text-muted-foreground">分享路线给朋友投票选择</Text>
              </View>
            </View>
            <Checkbox checked={false} />
          </View>
        </View>

      </View>

      {/* 底部操作栏 */}
      <View className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4 pb-8">
        <Button 
          className="w-full h-12 text-base font-medium"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Sparkles size={18} color="#ffffff" className="mr-2 animate-pulse" />
              规划中...
            </>
          ) : (
            <>
              生成路线
              <ChevronRight size={18} color="#ffffff" className="ml-2" />
            </>
          )}
        </Button>
      </View>

      {/* 日历弹窗 */}
      {renderCalendar()}
    </View>
  )
}
