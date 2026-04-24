import { useState, useEffect, useMemo } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Network } from '@/network'
import { InspirationCard, InspirationItem } from '@/components/inspiration-card'
import { ArrowLeft, Sparkles, SlidersHorizontal, MapPin, RotateCcw, X } from 'lucide-react-taro'
import { chinaProvinces, getCitiesByProvince } from '@/config/china-cities'
import { primaryTagConfig } from '../index/config'
import './index.config'

// 分类统计数据
interface CategoryStat {
  tag: string
  label: string
  icon: string
  count: number
  bgColor: string
  color: string
}

// 城市统计
interface CityStat {
  province: string
  city: string
  count: number
}

const SelectPage = () => {
  const [allInspirations, setAllInspirations] = useState<InspirationItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // 筛选状态 - 省市两级
  const [selectedProvince, setSelectedProvince] = useState<string>('')
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('全部')

  // 分类统计配置
  const categoryStats: CategoryStat[] = [
    { tag: '景点', ...primaryTagConfig['景点'], count: 0 },
    { tag: '美食', ...primaryTagConfig['美食'], count: 0 },
    { tag: '购物', ...primaryTagConfig['购物'], count: 0 },
    { tag: '活动', ...primaryTagConfig['活动'], count: 0 },
  ]

  useEffect(() => {
    fetchAllInspirations()
  }, [])

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true)
    await fetchAllInspirations()
    setRefreshing(false)
    Taro.showToast({ title: '刷新成功', icon: 'success' })
  }

  const fetchAllInspirations = async () => {
    setLoading(true)
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      const res = await Network.request({
        url: '/api/trip/inspirations',
        method: 'GET',
        data: { userId: userInfo?.id }
      })
      console.log('[Select] 获取所有灵感:', res.data)
      if (res.data?.data) {
        setAllInspirations(res.data.data)
      }
    } catch (err) {
      console.error('[Select] 获取失败:', err)
    } finally {
      setLoading(false)
    }
  }

  // 从灵感点中提取省市列表（按省-市两级）
  const provinceCityStats: CityStat[] = useMemo(() => {
    const statsMap = new Map<string, CityStat>()
    
    allInspirations.forEach(inspiration => {
      const location = inspiration.location_name || ''
      if (!location) return
      
      // 尝试匹配省和城市
      let matchedProvince = ''
      let matchedCity = ''
      
      // 先匹配城市（更精确）
      for (const province of chinaProvinces) {
        for (const city of province.cities) {
          const cityName = city.name.replace('市', '')
          if (location.includes(cityName) || location.includes(city.name)) {
            matchedProvince = province.name
            matchedCity = city.name
            break
          }
        }
        if (matchedCity) break
      }
      
      // 如果没匹配到城市，尝试匹配省份
      if (!matchedProvince) {
        for (const province of chinaProvinces) {
          const provinceName = province.name.replace(/省|市|自治区|特别行政区/g, '')
          if (location.includes(provinceName) || location.includes(province.name)) {
            matchedProvince = province.name
            break
          }
        }
      }
      
      if (matchedProvince || matchedCity) {
        const key = matchedCity || matchedProvince
        if (!statsMap.has(key)) {
          statsMap.set(key, { 
            province: matchedProvince, 
            city: matchedCity, 
            count: 0 
          })
        }
        statsMap.get(key)!.count++
      }
    })
    
    return Array.from(statsMap.values())
      .sort((a, b) => b.count - a.count)
  }, [allInspirations])

  // 获取有数据的省份列表
  const provincesWithData = useMemo(() => {
    const provinces = new Set<string>()
    provinceCityStats.forEach(stat => {
      if (stat.province) provinces.add(stat.province)
    })
    return Array.from(provinces).sort()
  }, [provinceCityStats])

  // 根据选择的省份获取城市列表
  const citiesInProvince = useMemo(() => {
    if (!selectedProvince) return []
    return provinceCityStats
      .filter(stat => stat.province === selectedProvince && stat.city)
      .map(stat => ({ city: stat.city, count: stat.count }))
      .sort((a, b) => b.count - a.count)
  }, [selectedProvince, provinceCityStats])

  // 判断是否有筛选条件
  const hasFilters = selectedProvince !== '' || selectedCity !== '' || selectedCategory !== '全部'

  // 重置筛选条件
  const resetFilters = () => {
    setSelectedProvince('')
    setSelectedCity('')
    setSelectedCategory('全部')
  }

  // 处理省份变化
  const handleProvinceChange = (province: string) => {
    setSelectedProvince(province)
    setSelectedCity('') // 切换省份时清空城市
  }

  // 处理收藏/取消收藏
  const handleFavorite = async (id: string, isFavorite: boolean) => {
    try {
      await Network.request({
        url: `/api/trip/inspirations/${id}/favorite`,
        method: 'POST',
        data: { isFavorite }
      })
      Taro.showToast({ 
        title: isFavorite ? '已收藏' : '已取消收藏', 
        icon: 'success' 
      })
      fetchAllInspirations()
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  // 处理删除
  const handleDelete = async (id: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这个灵感点吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/trip/inspirations/${id}`,
              method: 'DELETE'
            })
            Taro.showToast({ title: '已删除', icon: 'success' })
            fetchAllInspirations()
          } catch {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  // 处理选择/取消选择
  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // 全选当前筛选结果
  const selectAll = () => {
    filteredInspirations.forEach(i => {
      selectedIds.add(i.id)
    })
    setSelectedIds(new Set(selectedIds))
  }

  // 取消全选当前筛选结果
  const deselectAll = () => {
    filteredInspirations.forEach(i => {
      selectedIds.delete(i.id)
    })
    setSelectedIds(new Set(selectedIds))
  }

  // 开始规划
  const startPlanning = () => {
    if (selectedIds.size === 0) {
      Taro.showToast({ title: '请先选择灵感点', icon: 'none' })
      return
    }
    const selected = Array.from(selectedIds).join(',')
    Taro.navigateTo({ url: `/pages/generate/index?selected=${selected}` })
  }

  // 根据省+市+分类筛选
  const filteredInspirations = useMemo(() => {
    let result = allInspirations
    
    // 城市/省份筛选
    if (selectedCity) {
      // 精确匹配城市
      result = result.filter(i => {
        const location = i.location_name || ''
        return location.includes(selectedCity.replace('市', '')) || location.includes(selectedCity)
      })
    } else if (selectedProvince) {
      // 匹配该省份下的所有城市
      const provinceCities = getCitiesByProvince(selectedProvince)
      result = result.filter(i => {
        const location = i.location_name || ''
        return provinceCities.some(city => 
          location.includes(city.replace('市', '')) || location.includes(city)
        )
      })
    }
    
    // 分类筛选
    if (selectedCategory !== '全部') {
      result = result.filter(i => i.primary_tag === selectedCategory)
    }
    
    return result
  }, [allInspirations, selectedProvince, selectedCity, selectedCategory])

  // 获取分类统计（基于当前筛选后的结果）
  const getStats = () => {
    let baseData = allInspirations
    
    // 如果选了城市/省份
    if (selectedCity) {
      baseData = allInspirations.filter(i => {
        const location = i.location_name || ''
        return location.includes(selectedCity.replace('市', '')) || location.includes(selectedCity)
      })
    } else if (selectedProvince) {
      const provinceCities = getCitiesByProvince(selectedProvince)
      baseData = allInspirations.filter(i => {
        const location = i.location_name || ''
        return provinceCities.some(city => 
          location.includes(city.replace('市', '')) || location.includes(city)
        )
      })
    }
    
    return categoryStats.map(stat => ({
      ...stat,
      count: baseData.filter(i => i.primary_tag === stat.tag).length
    }))
  }

  // 获取当前筛选条件描述
  const getFilterDescription = () => {
    const parts: string[] = []
    if (selectedCity) parts.push(selectedCity)
    else if (selectedProvince) parts.push(selectedProvince)
    if (selectedCategory !== '全部') {
      const stat = getStats().find(s => s.tag === selectedCategory)
      if (stat) parts.push(stat.icon + stat.label)
    }
    return parts.length > 0 ? parts.join(' · ') : '全部'
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-32">
      {/* 顶部标题 */}
      <View className="bg-white px-4 py-3 flex items-center border-b border-gray-100">
        <View onClick={() => Taro.navigateBack()} className="p-2 -ml-2">
          <ArrowLeft size={20} color="#374151" />
        </View>
        <Text className="block text-lg font-semibold text-gray-900 ml-2">选择灵感</Text>
        <Badge variant="secondary" className="ml-auto">
          已选 {selectedIds.size} 个
        </Badge>
      </View>

      {/* 筛选区域 */}
      <View className="bg-white border-b border-gray-100">
        {/* 筛选标题行 */}
        <View className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
          <View className="flex items-center">
            <SlidersHorizontal size={16} color="#6b7280" />
            <Text className="block text-sm text-gray-600 ml-2">筛选条件</Text>
          </View>
          {hasFilters && (
            <View 
              className="flex items-center text-blue-500"
              onClick={resetFilters}
            >
              <RotateCcw size={14} color="#3b82f6" />
              <Text className="block text-sm text-blue-500 ml-1">重置</Text>
            </View>
          )}
        </View>
        
        {/* 省市+分类筛选行 */}
        <View className="px-4 py-3 space-y-3">
          {/* 省市选择 */}
          <View className="flex items-center gap-3">
            <View className="flex items-center flex-1">
              <Text className="block text-xs text-gray-400 mr-2 w-8">
                <MapPin size={12} color="#9ca3af" className="inline" />
              </Text>
              {/* 省份选择 */}
              <View className="flex-1">
                <Select
                  value={selectedProvince}
                  onValueChange={handleProvinceChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择省份" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全国</SelectItem>
                    {provincesWithData.map(province => (
                      <SelectItem key={province} value={province}>
                        {province}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </View>
            </View>
            
            {/* 城市选择 */}
            {selectedProvince && citiesInProvince.length > 0 && (
              <View className="flex-1">
                <Select
                  value={selectedCity}
                  onValueChange={setSelectedCity}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择城市" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部城市</SelectItem>
                    {citiesInProvince.map(({ city, count }) => (
                      <SelectItem key={city} value={city}>
                        {city.replace('市', '')} ({count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </View>
            )}
            
            {/* 清除城市按钮 */}
            {selectedCity && (
              <View 
                onClick={() => setSelectedCity('')}
                className="p-1"
              >
                <X size={16} color="#9ca3af" />
              </View>
            )}
          </View>
          
          {/* 分类选择 */}
          <View className="flex items-center gap-3">
            <Text className="block text-xs text-gray-400 w-8">类别</Text>
            <View className="flex-1">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="全部">🏠 全部</SelectItem>
                  <SelectItem value="景点">🏛️ 景点</SelectItem>
                  <SelectItem value="美食">🍜 美食</SelectItem>
                  <SelectItem value="购物">🛍️ 购物</SelectItem>
                  <SelectItem value="活动">🎭 活动</SelectItem>
                </SelectContent>
              </Select>
            </View>
          </View>
        </View>
        
        {/* 筛选结果统计 */}
        <View className="px-4 py-2 flex items-center gap-2 bg-gray-50 flex-wrap">
          <Badge variant="outline" className="text-xs">
            共 {filteredInspirations.length} 个
          </Badge>
          {getStats().filter(s => s.count > 0).map(stat => (
            <Badge 
              key={stat.tag}
              className="text-xs"
              style={{ backgroundColor: stat.bgColor, color: stat.color }}
            >
              {stat.icon} {stat.count}
            </Badge>
          ))}
        </View>
      </View>

      {/* 下拉刷新容器 */}
      <ScrollView
        className="flex-1"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
      >
        {/* 骨架屏加载状态 */}
        {loading && (
          <View className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <Card key={i}>
                <CardContent className="p-4">
                  <View className="flex items-start">
                    <Skeleton className="w-10 h-10 rounded-lg mr-3" />
                    <View className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24 mb-2" />
                      <Skeleton className="h-3 w-40" />
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        {/* 空状态 */}
        {!loading && filteredInspirations.length === 0 && (
          <View className="flex flex-col items-center justify-center py-20 px-4">
            <View className="w-20 h-20 bg-gradient-to-br from-blue-50 to-green-50 rounded-full flex items-center justify-center mb-4 border border-blue-100">
              <Sparkles size={40} color="#3b82f6" />
            </View>
            <Text className="block text-lg font-semibold text-gray-900 mb-2">
              {hasFilters ? '没有匹配的灵感点' : '还没有灵感点'}
            </Text>
            <Text className="block text-sm text-gray-500 text-center mb-6">
              {hasFilters ? '试试调整筛选条件，或增加灵感点收录' : '去首页粘贴链接收录灵感'}
            </Text>
            <Button 
              className="bg-gradient-to-r from-blue-500 to-blue-600"
              onClick={hasFilters ? resetFilters : () => Taro.navigateBack()}
            >
              {hasFilters ? (
                <>
                  <RotateCcw size={16} color="#fff" />
                  <Text className="text-white ml-2">重置筛选</Text>
                </>
              ) : (
                <>
                  <Sparkles size={16} color="#fff" />
                  <Text className="text-white ml-2">去收录灵感</Text>
                </>
              )}
            </Button>
          </View>
        )}

        {/* 灵感点列表 */}
        {!loading && filteredInspirations.length > 0 && (
          <View className="p-4 space-y-3">
            {/* 全选/取消全选 */}
            <View className="flex items-center justify-between mb-2">
              <Text className="text-sm text-gray-500">
                {getFilterDescription()} · {filteredInspirations.length} 个灵感点
              </Text>
              <Text 
                className="text-sm text-blue-500"
                onClick={() => {
                  const allSelected = filteredInspirations.every(i => selectedIds.has(i.id))
                  if (allSelected) {
                    deselectAll()
                  } else {
                    selectAll()
                  }
                }}
              >
                {filteredInspirations.every(i => selectedIds.has(i.id)) ? '取消全选' : '全选'}
              </Text>
            </View>
            
            {filteredInspirations.map((item) => (
              <InspirationCard
                key={item.id}
                item={item}
                showSelect
                selected={selectedIds.has(item.id)}
                onSelect={handleSelect}
                onFavorite={handleFavorite}
                onDelete={handleDelete}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* 底部规划按钮 */}
      {allInspirations.length > 0 && (
        <View 
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            backgroundColor: '#fff', borderTop: '1px solid #e5e5e5',
            padding: '16px', paddingBottom: '32px', zIndex: 100
          }}
        >
          <Button 
            className="w-full bg-blue-500"
            onClick={startPlanning}
          >
            <Sparkles size={16} color="#fff" />
            <Text className="text-white ml-2">开始规划路线 ({selectedIds.size})</Text>
          </Button>
        </View>
      )}
    </View>
  )
}

export default SelectPage
