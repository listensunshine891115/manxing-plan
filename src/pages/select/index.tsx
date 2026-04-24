import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Network } from '@/network'
import { MapPin, Utensils, Route, ArrowLeft } from 'lucide-react-taro'
import './index.config'

interface InspirationPoint {
  id: string
  title: string
  primary_tag: string
  secondary_tag: string
  location_name: string
  time: string
  price: string
  description: string
}

interface GroupedInspirations {
  tag: string
  tagColor: string
  tagBgColor: string
  icon: string
  items: InspirationPoint[]
  allSelected: boolean
}

export default function SelectPage() {
  const [groupedData, setGroupedData] = useState<GroupedInspirations[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllInspirations()
  }, [])

  const fetchAllInspirations = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/trip/inspirations',
        method: 'GET'
      })
      console.log('[Select] 获取所有灵感:', res.data)
      if (res.data?.success) {
        const data = res.data.data || []
        groupByTag(data)
      }
    } catch (err) {
      console.error('[Select] 获取失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const groupByTag = (data: InspirationPoint[]) => {
    const spotColor = 'text-blue-600'
    const spotBgColor = 'bg-blue-100'
    const foodColor = 'text-orange-600'
    const foodBgColor = 'bg-orange-100'

    const spots = data.filter(item => item.primary_tag === '景点')
    const foods = data.filter(item => item.primary_tag === '美食')

    const groups: GroupedInspirations[] = []

    if (spots.length > 0) {
      groups.push({
        tag: '景点',
        tagColor: spotColor,
        tagBgColor: spotBgColor,
        icon: 'MapPin',
        items: spots,
        allSelected: false
      })
    }

    if (foods.length > 0) {
      groups.push({
        tag: '美食',
        tagColor: foodColor,
        tagBgColor: foodBgColor,
        icon: 'Utensils',
        items: foods,
        allSelected: false
      })
    }

    setGroupedData(groups)
  }

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
    updateGroupAllSelected(newSelected)
  }

  const toggleGroupAll = (groupIndex: number) => {
    const group = groupedData[groupIndex]
    const newSelected = new Set(selectedIds)
    const allSelected = group.items.every(item => selectedIds.has(item.id))
    
    if (allSelected) {
      // 取消全选
      group.items.forEach(item => newSelected.delete(item.id))
    } else {
      // 全选
      group.items.forEach(item => newSelected.add(item.id))
    }
    
    setSelectedIds(newSelected)
    updateGroupAllSelected(newSelected)
  }

  const updateGroupAllSelected = (selected: Set<string>) => {
    setGroupedData(groups => groups.map(group => ({
      ...group,
      allSelected: group.items.length > 0 && group.items.every(item => selected.has(item.id))
    })))
  }

  const getSelectedItems = () => {
    const allItems = groupedData.flatMap(g => g.items)
    return allItems.filter(item => selectedIds.has(item.id))
  }

  const handleGenerateRoute = () => {
    const selectedItems = getSelectedItems()
    if (selectedItems.length === 0) {
      Taro.showToast({ title: '请先选择灵感点', icon: 'none' })
      return
    }
    
    // 跳转到路线生成页面，传递选中的灵感点
    Taro.navigateTo({
      url: `/pages/route/index?items=${encodeURIComponent(JSON.stringify(selectedItems))}`
    })
  }

  const totalSelected = selectedIds.size
  const totalCount = groupedData.reduce((sum, g) => sum + g.items.length, 0)

  return (
    <View className="min-h-screen bg-gray-50 pb-24">
      {/* 顶部标题 */}
      <View className="bg-white px-4 py-3 flex items-center border-b border-gray-100">
        <View onClick={() => Taro.navigateBack()} className="p-2 -ml-2">
          <ArrowLeft size={20} color="#374151" />
        </View>
        <Text className="block text-lg font-semibold text-gray-900 ml-2">
          选择灵感点
        </Text>
        <Badge className="ml-auto bg-gray-100 text-gray-600">
          已选 {totalSelected}/{totalCount}
        </Badge>
      </View>

      {loading ? (
        <View className="flex justify-center py-20">
          <Text className="block text-gray-400">加载中...</Text>
        </View>
      ) : groupedData.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-20 px-4">
          <View className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <MapPin size={40} color="#9CA3AF" />
          </View>
          <Text className="block text-gray-600 text-center mb-2">
            还没有收录任何灵感点
          </Text>
          <Text className="block text-gray-400 text-sm text-center mb-6">
            先去收录一些灵感点吧
          </Text>
          <Button onClick={() => Taro.navigateBack()}>
            <Text className="block">去收录</Text>
          </Button>
        </View>
      ) : (
        <View className="p-4 space-y-4">
          {groupedData.map((group, groupIndex) => (
            <View key={group.tag}>
              {/* 大类标题 */}
              <View className="flex items-center mb-3">
                <View 
                  onClick={() => toggleGroupAll(groupIndex)}
                  className="mr-3"
                >
                  <Checkbox 
                    checked={group.allSelected} 
                    className={group.tagBgColor}
                  />
                </View>
                <View className={`w-8 h-8 rounded-lg ${group.tagBgColor} flex items-center justify-center mr-2`}>
                  {group.icon === 'MapPin' ? (
                    <MapPin size={16} color={group.tagColor.includes('blue') ? '#3B82F6' : '#F59E0B'} />
                  ) : (
                    <Utensils size={16} color={group.tagColor.includes('blue') ? '#3B82F6' : '#F59E0B'} />
                  )}
                </View>
                <Text className="block font-medium text-gray-900">{group.tag}</Text>
                <Text className="block text-sm text-gray-400 ml-2">
                  {group.items.length} 个
                </Text>
              </View>

              {/* 灵感点列表 */}
              <View className="space-y-2 ml-11">
                {group.items.map((item) => (
                  <Card 
                    key={item.id} 
                    className={`bg-white ${selectedIds.has(item.id) ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => toggleItem(item.id)}
                  >
                    <CardContent className="p-3 flex items-start">
                      <View className="mt-1 mr-3">
                        <Checkbox 
                          checked={selectedIds.has(item.id)}
                        />
                      </View>
                      <View className="flex-1">
                        <View className="flex items-start justify-between">
                          <Text className="block text-sm font-medium text-gray-900">
                            {item.title}
                          </Text>
                          {item.secondary_tag && (
                            <Badge className={`text-xs ${group.tagBgColor} ${group.tagColor}`}>
                              {item.secondary_tag}
                            </Badge>
                          )}
                        </View>
                        {item.location_name && (
                          <Text className="block text-xs text-gray-400 mt-1">
                            {item.location_name}
                          </Text>
                        )}
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 底部固定按钮 */}
      {totalCount > 0 && (
        <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-6">
          <View className="flex items-center justify-between mb-3">
            <Text className="block text-sm text-gray-500">
              已选择 {totalSelected} 个灵感点
            </Text>
          </View>
          <Button 
            onClick={handleGenerateRoute}
            disabled={totalSelected === 0}
            className={`w-full ${totalSelected > 0 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300'} text-white`}
          >
            <Route size={18} color="#FFFFFF" className="mr-2" />
            <Text className="block">生成路线</Text>
          </Button>
        </View>
      )}
    </View>
  )
}
