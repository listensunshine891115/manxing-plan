import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, CalendarDays, Clock, Wallet, Car, Bus, Sparkles, MapPin, Users, ChevronRight } from 'lucide-react-taro'
import { format } from 'date-fns'
import { Network } from '@/network'
import './index.css'

// 出行需求选项
const demandOptions = [
  { value: 'relax', label: '休闲放松', icon: '🧘', desc: '慢节奏，重体验' },
  { value: 'adventure', label: '探索冒险', icon: '🏔️', desc: '多打卡，重发现' },
  { value: 'food', label: '美食之旅', icon: '🍜', desc: '吃遍当地美味' },
  { value: 'culture', label: '文化沉浸', icon: '🏛️', desc: '博物馆、历史' }
]

export default function Generate() {
  // 出行设置
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [days, setDays] = useState(3)
  const [budget, setBudget] = useState<number>(0)
  const [transportMode, setTransportMode] = useState<'public' | 'self-drive'>('public')
  const [selectedDemand, setSelectedDemand] = useState<string>('relax')
  const [mainDestination, setMainDestination] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)
  
  // 生成状态
  const [generating, setGenerating] = useState(false)

  // 模拟当前用户
  const userId = 'user_' + Date.now()

  // 生成路线
  const handleGenerate = async () => {
    setGenerating(true)
    
    try {
      // 调用后端生成路线
      const res = await Network.request({
        url: '/api/trip/generate',
        method: 'POST',
        data: {
          userId,
          settings: {
            start_date: format(startDate, 'yyyy-MM-dd'),
            days,
            budget: budget > 0 ? budget : undefined,
            transport_mode: transportMode,
            demand: selectedDemand,
            main_destination: mainDestination
          }
        }
      })
      
      console.log('[POST] /api/trip/generate - Response:', JSON.stringify(res.data))
      
      // 跳转到路线展示页
      window.location.href = '/pages/route/index'
    } catch (error) {
      console.error('生成路线失败:', error)
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
