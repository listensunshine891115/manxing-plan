import { useState, useEffect } from 'react'
import { View, Text, Picker } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ArrowLeft, CalendarDays, CalendarRange, Car, Bus, MapPin, Search, X, ChevronRight, ChevronLeft, Loader, Users, Wand, Check } from 'lucide-react-taro'
import { format, differenceInDays, addDays } from 'date-fns'
import { Network } from '@/network'
import Taro from '@tarojs/taro'
import './index.css'

// 集合地点搜索结果类型
interface PlaceResult {
  name: string
  address: string
  lat: number
  lng: number
}

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
  // 步骤状态：'companion' -> 是否邀请同伴, 'settings' -> 出行设置
  const [step, setStep] = useState<'companion' | 'settings'>('companion')
  const [inviteCompanion, setInviteCompanion] = useState(false)

  // 出行设置（仅在邀请同伴时需要）
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [startTime, setStartTime] = useState('09:00')
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 3))
  const [endTime, setEndTime] = useState('18:00')
  const [transportMode, setTransportMode] = useState<'public' | 'self-drive'>('public')
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)

  // 计算行程天数
  const tripDays = differenceInDays(endDate, startDate) + 1

  // 时间选项（每10分钟）
  const timeOptions = Array.from({ length: 144 }, (_, i) => {
    const hours = Math.floor(i / 6)
    const minutes = (i % 6) * 10
    const value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    return { value, label: value }
  })

  // 集合地点
  const [meetingPoint, setMeetingPoint] = useState('')
  const [meetingCoords, setMeetingCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [searching, setSearching] = useState(false)
  const [inputValue, setInputValue] = useState('')

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

  // 搜索集合地点
  const searchMeetingPoint = async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const res = await Network.request({
        url: '/api/map/search',
        method: 'POST',
        data: { keywords: keyword }
      })

      console.log('[POST] /api/map/search - Response:', res.data)

      if (res.data && res.data.data) {
        setSearchResults(res.data.data)
        setShowSearch(true)
      }
    } catch (error) {
      console.error('搜索地点失败:', error)
      setSearchResults([
        { name: keyword, address: '搜索结果', lat: 24.48 + Math.random(), lng: 118.11 + Math.random() }
      ])
      setShowSearch(true)
    } finally {
      setSearching(false)
    }
  }

  // 选择搜索结果
  const selectMeetingPoint = (place: PlaceResult) => {
    setMeetingPoint(place.name)
    setMeetingCoords({ lat: place.lat, lng: place.lng })
    setInputValue('')
    setShowSearch(false)
    setSearchResults([])
  }

  // 清除集合地点
  const clearMeetingPoint = () => {
    setMeetingPoint('')
    setMeetingCoords(null)
    setInputValue('')
  }

  // 生成路线
  const handleGenerate = async () => {
    if (selectedInspirations.length === 0) {
      Taro.showToast({ title: '请先选择灵感点', icon: 'none' })
      return
    }

    setGenerating(true)

    try {
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

      const requestData: any = {
        inspirations: inspirationsData,
        days: inviteCompanion ? tripDays : undefined,
        startDate: inviteCompanion ? format(startDate, 'yyyy-MM-dd') : undefined
      }

      // 如果邀请同伴，添加出行设置
      if (inviteCompanion) {
        requestData.transportMode = transportMode
        requestData.meetingPoint = meetingCoords ? {
          name: meetingPoint,
          lat: meetingCoords.lat,
          lng: meetingCoords.lng
        } : undefined
        requestData.startTime = startTime
        requestData.endTime = endTime
      }

      const res = await Network.request({
        url: '/api/trip/route/plan',
        method: 'POST',
        data: requestData
      })

      console.log('[POST] /api/trip/route/plan - Response:', res.data)

      if (res.data && res.data.code === 200 && res.data.data) {
        const result: RoutePlanResult = res.data.data

        if (meetingCoords) {
          result.settings.mainDestination = meetingPoint
        }

        await Taro.setStorage({ key: 'routePlanResult', data: result })
        Taro.navigateTo({ url: '/pages/confirm/index' })
      } else {
        throw new Error(res.data?.msg || '路线规划失败')
      }
    } catch (error) {
      console.error('生成路线失败:', error)
      Taro.showToast({ title: '生成路线失败，请重试', icon: 'none' })
      setGenerating(false)
    }
  }

  // 渲染日期选择弹窗
  const renderDatePickers = () => (
    <>
      {showStartPicker && (
        <View className="calendar-overlay" onClick={() => setShowStartPicker(false)}>
          <View className="calendar-container" onClick={e => e.stopPropagation()}>
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => {
                if (date) {
                  setStartDate(date)
                  if (date > endDate) {
                    setEndDate(addDays(date, 0))
                  }
                  setShowStartPicker(false)
                }
              }}
              disabled={(date) => date < new Date()}
            />
          </View>
        </View>
      )}

      {showEndPicker && (
        <View className="calendar-overlay" onClick={() => setShowEndPicker(false)}>
          <View className="calendar-container" onClick={e => e.stopPropagation()}>
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => {
                if (date) {
                  if (date >= startDate) {
                    setEndDate(date)
                    setShowEndPicker(false)
                  } else {
                    Taro.showToast({ title: '结束日期不能早于起始日期', icon: 'none' })
                  }
                }
              }}
              disabled={(date) => date < startDate}
            />
          </View>
        </View>
      )}
    </>
  )

  // 步骤一：选择是否邀请同伴
  const renderCompanionStep = () => (
    <View className="px-4 py-5">
      {/* 标题 */}
      <View className="text-center mb-8">
        <Text className="block text-2xl font-semibold text-gray-900">是否邀请同伴</Text>
        <Text className="block text-sm text-gray-500 mt-2">邀请同伴可以一起规划路线并投票选择</Text>
      </View>

      {/* 选项卡片 */}
      <View className="space-y-4">
        {/* 不邀请 */}
        <View 
          className={`p-6 rounded-2xl border-2 transition-all ${!inviteCompanion ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
          onClick={() => setInviteCompanion(false)}
        >
          <View className="flex items-center justify-between">
            <View className="flex items-center">
              <View className={`w-12 h-12 rounded-full flex items-center justify-center ${!inviteCompanion ? 'bg-blue-500' : 'bg-gray-200'}`}>
                <Users size={24} color={!inviteCompanion ? '#ffffff' : '#9ca3af'} />
              </View>
              <View className="ml-4">
                <Text className="block text-lg font-medium text-gray-900">自己出行</Text>
                <Text className="block text-sm text-gray-500 mt-1">直接生成最佳路线</Text>
              </View>
            </View>
            {!inviteCompanion && (
              <View className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                <Check size={14} color="#ffffff" />
              </View>
            )}
          </View>
        </View>

        {/* 邀请同伴 */}
        <View 
          className={`p-6 rounded-2xl border-2 transition-all ${inviteCompanion ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
          onClick={() => setInviteCompanion(true)}
        >
          <View className="flex items-center justify-between">
            <View className="flex items-center">
              <View className={`w-12 h-12 rounded-full flex items-center justify-center ${inviteCompanion ? 'bg-blue-500' : 'bg-gray-200'}`}>
                <Users size={24} color={inviteCompanion ? '#ffffff' : '#9ca3af'} />
              </View>
              <View className="ml-4">
                <Text className="block text-lg font-medium text-gray-900">邀请同伴投票</Text>
                <Text className="block text-sm text-gray-500 mt-1">设置出行计划，邀请朋友投票</Text>
              </View>
            </View>
            {inviteCompanion && (
              <View className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                <Check size={14} color="#ffffff" />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 底部按钮 */}
      <View className="mt-8">
        <Button 
          className="w-full h-12 text-base font-medium bg-blue-500"
          onClick={() => {
            if (inviteCompanion) {
              setStep('settings')
            } else {
              handleGenerate()
            }
          }}
        >
          {inviteCompanion ? (
            <>
              <Text className="text-white">下一步</Text>
              <ChevronRight size={18} color="#ffffff" className="ml-2" />
            </>
          ) : (
            <>
              <Wand size={18} color="#ffffff" className="mr-2" />
              <Text className="text-white">生成路线</Text>
            </>
          )}
        </Button>
      </View>
    </View>
  )

  // 步骤二：出行设置（仅邀请同伴时显示）
  const renderSettingsStep = () => (
    <View className="px-4 py-5 space-y-4">
      {/* 返回按钮 */}
      <View 
        className="flex items-center text-blue-500 mb-2"
        onClick={() => setStep('companion')}
      >
        <ChevronLeft size={18} color="#3b82f6" />
        <Text className="block text-sm text-blue-500">返回</Text>
      </View>

      {/* 出发时间 */}
      <View className="bg-white rounded-xl p-4 shadow-sm">
        <View className="flex items-center mb-3">
          <View className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <CalendarDays size={16} color="#3b82f6" />
          </View>
          <Text className="block text-sm font-medium text-gray-900 ml-2">出发时间</Text>
        </View>
        <Button 
          variant="outline" 
          className="w-full justify-start h-11 border-gray-200 mb-3"
          onClick={() => setShowStartPicker(true)}
        >
          <Text className="block text-sm text-gray-700">
            {format(startDate, 'yyyy年MM月dd日')}
          </Text>
        </Button>
        <View className="flex items-center">
          <Text className="block text-xs text-gray-500 mr-2">集合时间</Text>
          <Picker
            mode="selector"
            range={timeOptions}
            rangeKey="label"
            value={timeOptions.findIndex(t => t.value === startTime)}
            onChange={(e: any) => setStartTime(timeOptions[e.detail.value].value)}
          >
            <View className="px-4 py-2 bg-gray-50 rounded-lg">
              <Text className="block text-sm text-gray-900">{startTime}</Text>
            </View>
          </Picker>
        </View>
      </View>

      {/* 返程时间 */}
      <View className="bg-white rounded-xl p-4 shadow-sm">
        <View className="flex items-center mb-3">
          <View className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <CalendarRange size={16} color="#3b82f6" />
          </View>
          <Text className="block text-sm font-medium text-gray-900 ml-2">返程时间</Text>
          <Text className="block text-xs text-gray-400 ml-auto">共 {tripDays} 天</Text>
        </View>
        <Button 
          variant="outline" 
          className="w-full justify-start h-11 border-gray-200 mb-3"
          onClick={() => setShowEndPicker(true)}
        >
          <Text className="block text-sm text-gray-700">
            {format(endDate, 'yyyy年MM月dd日')}
          </Text>
        </Button>
        <View className="flex items-center">
          <Text className="block text-xs text-gray-500 mr-2">返程时间</Text>
          <Picker
            mode="selector"
            range={timeOptions}
            rangeKey="label"
            value={timeOptions.findIndex(t => t.value === endTime)}
            onChange={(e: any) => setEndTime(timeOptions[e.detail.value].value)}
          >
            <View className="px-4 py-2 bg-gray-50 rounded-lg">
              <Text className="block text-sm text-gray-900">{endTime}</Text>
            </View>
          </Picker>
        </View>
      </View>

      {/* 出行方式 */}
      <View className="bg-white rounded-xl p-4 shadow-sm">
        <View className="flex items-center mb-3">
          <View className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            {transportMode === 'public' ? (
              <Bus size={16} color="#3b82f6" />
            ) : (
              <Car size={16} color="#3b82f6" />
            )}
          </View>
          <Text className="block text-sm font-medium text-gray-900 ml-2">出行方式</Text>
        </View>
        <RadioGroup 
          value={transportMode} 
          onValueChange={(val) => setTransportMode(val as 'public' | 'self-drive')}
          className="flex gap-3"
        >
          <View 
            className="flex-1 flex items-center justify-center py-3 rounded-xl border cursor-pointer"
            onClick={() => setTransportMode('public')}
            style={{
              backgroundColor: transportMode === 'public' ? '#eff6ff' : '#f8fafc',
              borderColor: transportMode === 'public' ? '#3b82f6' : '#e2e8f0'
            }}
          >
            <RadioGroupItem value="public" />
            <View className="flex items-center ml-2">
              <Bus size={16} color={transportMode === 'public' ? '#3b82f6' : '#64748b'} />
              <Text 
                className="block text-sm ml-1"
                style={{ color: transportMode === 'public' ? '#3b82f6' : '#64748b' }}
              >
                公共交通
              </Text>
            </View>
          </View>
          <View 
            className="flex-1 flex items-center justify-center py-3 rounded-xl border cursor-pointer"
            onClick={() => setTransportMode('self-drive')}
            style={{
              backgroundColor: transportMode === 'self-drive' ? '#eff6ff' : '#f8fafc',
              borderColor: transportMode === 'self-drive' ? '#3b82f6' : '#e2e8f0'
            }}
          >
            <RadioGroupItem value="self-drive" />
            <View className="flex items-center ml-2">
              <Car size={16} color={transportMode === 'self-drive' ? '#3b82f6' : '#64748b'} />
              <Text 
                className="block text-sm ml-1"
                style={{ color: transportMode === 'self-drive' ? '#3b82f6' : '#64748b' }}
              >
                自驾出行
              </Text>
            </View>
          </View>
        </RadioGroup>
      </View>

      {/* 集合地点 */}
      <View className="bg-white rounded-xl p-4 shadow-sm">
        <View className="flex items-center mb-3">
          <View className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <MapPin size={16} color="#3b82f6" />
          </View>
          <Text className="block text-sm font-medium text-gray-900 ml-2">集合地点</Text>
          <Text className="block text-xs text-gray-400 ml-auto">同伴在此集合</Text>
        </View>
        
        {meetingPoint ? (
          <View className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <View className="flex items-center flex-1">
              <MapPin size={16} color="#10b981" />
              <Text className="block text-sm text-green-700 ml-2 flex-1 truncate">
                {meetingPoint}
              </Text>
            </View>
            <View 
              className="p-1"
              onClick={clearMeetingPoint}
            >
              <X size={16} color="#10b981" />
            </View>
          </View>
        ) : (
          <View className="relative">
            <View className="flex items-center bg-gray-50 rounded-lg px-3 py-2">
              <Search size={16} color="#9ca3af" />
              <Input
                className="flex-1 ml-2 text-sm bg-transparent"
                placeholder="输入集合地点名称后回车搜索"
                value={inputValue}
                onInput={(e: any) => setInputValue(e.detail.value)}
                onConfirm={() => {
                  if (inputValue.trim()) {
                    searchMeetingPoint(inputValue.trim())
                  }
                }}
              />
              {searching && (
                <Loader size={16} color="#3b82f6" className="animate-spin" />
              )}
            </View>

            {showSearch && searchResults.length > 0 && (
              <View className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 z-50 max-h-48 overflow-y-auto">
                {searchResults.map((place, index) => (
                  <View 
                    key={index}
                    className="px-3 py-3 border-b border-gray-50 last:border-b-0"
                    onClick={() => selectMeetingPoint(place)}
                  >
                    <View className="flex items-start">
                      <MapPin size={14} color="#64748b" className="mt-1" />
                      <View className="ml-2 flex-1">
                        <Text className="block text-sm text-gray-900">{place.name}</Text>
                        {place.address && (
                          <Text className="block text-xs text-gray-500 mt-1">{place.address}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {showSearch && (
              <View 
                className="fixed inset-0 z-40" 
                onClick={() => {
                  setShowSearch(false)
                  setSearchResults([])
                }}
              />
            )}
          </View>
        )}

        {meetingCoords && (
          <Text className="block text-xs text-gray-400 mt-2">
            已定位：({meetingCoords.lat.toFixed(4)}, {meetingCoords.lng.toFixed(4)})
          </Text>
        )}
      </View>
    </View>
  )

  return (
    <View className="min-h-screen bg-gray-50 pb-28">
      {/* 顶部导航 */}
      <View className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <View className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={24} color="#1E293B" />
          </Button>
          <Text className="block text-lg font-semibold text-gray-900 ml-2">
            {step === 'companion' ? '出行设置' : '详细设置'}
          </Text>
        </View>
      </View>

      {/* 选中的灵感点预览 */}
      {selectedInspirations.length > 0 && (
        <View className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
          <View className="flex items-center justify-between mb-2">
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
              {selectedInspirations.slice(0, 5).map(ins => (
                <View 
                  key={ins.id}
                  className="px-2 py-1 bg-white rounded-full border border-blue-200 flex items-center"
                >
                  <Text className="block text-xs text-gray-700">
                    {ins.type === 'food' ? '🍜' : ins.type === 'shopping' ? '🛍️' : '🏛️'}
                  </Text>
                  <Text className="block text-xs text-gray-700 ml-1 max-w-20 truncate">
                    {ins.title}
                  </Text>
                </View>
              ))}
              {selectedInspirations.length > 5 && (
                <View className="px-2 py-1 bg-white bg-opacity-50 rounded-full">
                  <Text className="block text-xs text-gray-500">
                    +{selectedInspirations.length - 5}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* 步骤一：选择是否邀请同伴 */}
      {step === 'companion' && renderCompanionStep()}

      {/* 步骤二：出行设置 */}
      {step === 'settings' && (
        <>
          {renderSettingsStep()}
          
          {/* 底部生成按钮 */}
          <View 
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              backgroundColor: '#fff', borderTop: '1px solid #e5e5e5',
              padding: '16px', paddingBottom: '32px', zIndex: 100
            }}
          >
            <Button 
              className="w-full h-12 text-base font-medium bg-blue-500"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader size={18} color="#ffffff" className="mr-2 animate-spin" />
                  <Text className="text-white">规划中...</Text>
                </>
              ) : (
                <>
                  <Wand size={18} color="#ffffff" className="mr-2" />
                  <Text className="text-white">生成路线</Text>
                </>
              )}
            </Button>
          </View>
        </>
      )}

      {/* 日期选择弹窗 */}
      {renderDatePickers()}
    </View>
  )
}
