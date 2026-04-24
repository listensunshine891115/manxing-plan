import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ArrowLeft, CalendarDays, Clock, Wallet, Car, Bus, Sparkles } from 'lucide-react-taro'
import { format } from 'date-fns'
import './index.css'

export default function Generate() {
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [days, setDays] = useState(3)
  const [budget, setBudget] = useState<number>(0)
  const [transportMode, setTransportMode] = useState<'public' | 'self-drive'>('public')
  const [showCalendar, setShowCalendar] = useState(false)
  const [loading, setLoading] = useState(false)

  // 生成路线
  const handleGenerate = async () => {
    setLoading(true)
    
    try {
      // 跳转到路线展示页
      window.location.href = '/pages/route/index'
    } catch (error) {
      console.error('生成路线失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 渲染日历选择
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
    <View className="min-h-screen bg-background pb-24">
      {/* 顶部导航 */}
      <View className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <View className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft size={24} color="#1E293B" />
          </Button>
          <Text className="block text-lg font-semibold text-foreground ml-2">生成路线</Text>
        </View>
      </View>

      {/* 设置表单 */}
      <View className="px-4 py-6 space-y-6">
        {/* 出发日期 */}
        <View className="setting-card">
          <View className="setting-header">
            <CalendarDays size={20} color="#3B82F6" />
            <Text className="block text-base font-medium text-foreground">出发日期</Text>
          </View>
          <Button 
            variant="outline" 
            className="w-full justify-start mt-3 h-12"
            onClick={() => setShowCalendar(true)}
          >
            <Text className="block text-sm text-foreground">
              {format(startDate, 'yyyy年MM月dd日')}
            </Text>
          </Button>
        </View>

        {/* 行程天数 */}
        <View className="setting-card">
          <View className="setting-header">
            <Clock size={20} color="#3B82F6" />
            <Text className="block text-base font-medium text-foreground">行程天数</Text>
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
              <Text className="block text-sm text-muted-foreground">1天</Text>
              <Text className="block text-lg font-semibold text-primary">{days}天</Text>
              <Text className="block text-sm text-muted-foreground">7天</Text>
            </View>
          </View>
        </View>

        {/* 预算范围 */}
        <View className="setting-card">
          <View className="setting-header">
            <Wallet size={20} color="#3B82F6" />
            <Text className="block text-base font-medium text-foreground">预算范围（可选）</Text>
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
              <Text className="block text-sm text-muted-foreground">不限</Text>
              <Text className="block text-lg font-semibold text-primary">
                {budget > 0 ? `¥${budget}` : '不限'}
              </Text>
              <Text className="block text-sm text-muted-foreground">¥10000</Text>
            </View>
          </View>
        </View>

        {/* 出行方式 */}
        <View className="setting-card">
          <View className="setting-header">
            <Bus size={20} color="#3B82F6" />
            <Text className="block text-base font-medium text-foreground">出行方式</Text>
          </View>
          <RadioGroup 
            value={transportMode} 
            onValueChange={(val) => setTransportMode(val as 'public' | 'self-drive')}
            className="mt-3 space-y-3"
          >
            <View className="flex items-center justify-between p-3 rounded-lg border border-border">
              <View className="flex items-center">
                <RadioGroupItem value="public" id="public" />
                <View className="flex items-center ml-3 cursor-pointer">
                  <Bus size={18} color="#64748B" />
                  <Text className="block text-sm text-foreground ml-2">公共交通</Text>
                </View>
              </View>
            </View>
            <View className="flex items-center justify-between p-3 rounded-lg border border-border">
              <View className="flex items-center">
                <RadioGroupItem value="self-drive" id="self-drive" />
                <View className="flex items-center ml-3 cursor-pointer">
                  <Car size={18} color="#64748B" />
                  <Text className="block text-sm text-foreground ml-2">自驾出行</Text>
                </View>
              </View>
            </View>
          </RadioGroup>
        </View>

        {/* 预览信息 */}
        <View className="setting-card" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
          <View className="flex items-center mb-2">
            <Sparkles size={18} color="#3B82F6" />
            <Text className="block text-sm font-medium text-primary ml-2">自动规划说明</Text>
          </View>
          <Text className="block text-xs text-muted-foreground leading-relaxed">
            系统将根据您的目的地、时间和预算，自动规划最优路线，支持生成多个版本供选择。
          </Text>
        </View>
      </View>

      {/* 底部固定按钮 */}
      <View className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4 pb-8">
        <Button 
          className="w-full h-12 text-base font-medium"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? '规划中...' : '开始生成'}
        </Button>
      </View>

      {/* 日历弹窗 */}
      {renderCalendar()}
    </View>
  )
}
