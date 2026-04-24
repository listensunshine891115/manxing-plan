import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Network } from '@/network'
import { MapPin, Utensils, Route, ArrowLeft, Link2, X, Plus } from 'lucide-react-taro'
import './index.config'

interface InspirationPoint {
  id?: string
  name: string
  primary_tag: string
  secondary_tag: string
  location: string
  time: string
  price: string
  description: string
  sourceUrl?: string
  tags?: string[]
  selected?: boolean
}

interface GroupedInspirations {
  tag: string
  tagColor: string
  tagBgColor: string
  items: InspirationPoint[]
}

export default function SelectPage() {
  const [groupedData, setGroupedData] = useState<GroupedInspirations[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  
  // 链接提取相关状态
  const [showExtractDialog, setShowExtractDialog] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractedPoints, setExtractedPoints] = useState<InspirationPoint[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

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

  const groupByTag = (data: any[]) => {
    const spots = data.filter(item => item.primary_tag === '景点')
    const foods = data.filter(item => item.primary_tag === '美食')

    const groups: GroupedInspirations[] = []

    if (spots.length > 0) {
      groups.push({
        tag: '景点',
        tagColor: 'text-blue-600',
        tagBgColor: 'bg-blue-100',
        items: spots.map(item => ({
          ...item,
          name: item.title
        }))
      })
    }

    if (foods.length > 0) {
      groups.push({
        tag: '美食',
        tagColor: 'text-orange-600',
        tagBgColor: 'bg-orange-100',
        items: foods.map(item => ({
          ...item,
          name: item.title
        }))
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
  }

  const toggleGroupAll = (groupIndex: number) => {
    const group = groupedData[groupIndex]
    const newSelected = new Set(selectedIds)
    const allSelected = group.items.every(item => selectedIds.has(item.id!))
    
    if (allSelected) {
      group.items.forEach(item => item.id && newSelected.delete(item.id))
    } else {
      group.items.forEach(item => item.id && newSelected.add(item.id))
    }
    
    setSelectedIds(newSelected)
  }

  const handleExtractByLink = async () => {
    if (!linkInput.trim()) {
      Taro.showToast({ title: '请输入链接或文字', icon: 'none' })
      return
    }

    setExtracting(true)
    setExtractedPoints([])
    
    try {
      const isUrl = linkInput.includes('http://') || linkInput.includes('https://')
      
      setPreviewLoading(true)
      const res = await Network.request({
        url: '/api/trip/preview',
        method: 'POST',
        data: {
          userId: Taro.getStorageSync('userInfo')?.id,
          url: isUrl ? linkInput.trim() : undefined,
          text: !isUrl ? linkInput.trim() : undefined
        },
        timeout: 120000
      })
      setPreviewLoading(false)

      console.log('[Extract] 预览响应:', res.data)

      if (res.data?.success && res.data?.data?.inspirationPoints?.length > 0) {
        // 有关灵感点，展示让用户选择
        const points = res.data.data.inspirationPoints.map((p: any) => ({
          ...p,
          selected: true
        }))
        setExtractedPoints(points)
        Taro.showToast({ title: `提取到 ${points.length} 个灵感点`, icon: 'success' })
      } else {
        Taro.showToast({ title: res.data?.message || '未能提取到灵感点', icon: 'none' })
      }
    } catch (err: any) {
      setPreviewLoading(false)
      console.error('[Extract] 提取失败:', err)
      Taro.showToast({ title: '提取失败: ' + (err.message || ''), icon: 'none' })
    } finally {
      setExtracting(false)
    }
  }

  const toggleExtractedPoint = (index: number) => {
    const newPoints = [...extractedPoints]
    newPoints[index].selected = !newPoints[index].selected
    setExtractedPoints(newPoints)
  }

  const toggleExtractedAll = () => {
    const allSelected = extractedPoints.every(p => p.selected)
    setExtractedPoints(extractedPoints.map(p => ({
      ...p,
      selected: !allSelected
    })))
  }

  const handleSaveExtracted = async () => {
    const selectedToSave = extractedPoints.filter(p => p.selected)
    if (selectedToSave.length === 0) {
      Taro.showToast({ title: '请选择要收录的灵感点', icon: 'none' })
      return
    }

    try {
      Taro.showLoading({ title: '正在收录...' })
      
      const items = selectedToSave.map(p => ({
        user_id: Taro.getStorageSync('userInfo')?.id,
        title: p.name,
        source: 'xiaohongshu',
        primary_tag: p.primary_tag,
        secondary_tag: p.secondary_tag || '',
        location_name: p.location || '',
        time: p.time || '',
        price: p.price || '',
        description: p.description || '',
        original_url: p.sourceUrl || '',
        tags: p.tags || []
      }))

      const res = await Network.request({
        url: '/api/trip/inspirations/batch',
        method: 'POST',
        data: { items }
      })

      Taro.hideLoading()

      if (res.data?.code === 200 || res.data?.success) {
        Taro.showToast({ title: `已收录 ${selectedToSave.length} 个灵感点`, icon: 'success' })
        setShowExtractDialog(false)
        setLinkInput('')
        setExtractedPoints([])
        fetchAllInspirations()
      } else {
        Taro.showToast({ title: '收录失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      console.error('[Save] 收录失败:', err)
      Taro.showToast({ title: '收录失败', icon: 'none' })
    }
  }

  const getSelectedItems = () => {
    const allItems = groupedData.flatMap(g => g.items)
    return allItems.filter(item => selectedIds.has(item.id!))
  }

  const handleGenerateRoute = () => {
    const selectedItems = getSelectedItems()
    if (selectedItems.length === 0) {
      Taro.showToast({ title: '请先选择灵感点', icon: 'none' })
      return
    }
    
    Taro.navigateTo({
      url: `/pages/route/index?items=${encodeURIComponent(JSON.stringify(selectedItems))}`
    })
  }

  const totalSelected = selectedIds.size
  const totalCount = groupedData.reduce((sum, g) => sum + g.items.length, 0)
  const extractedSelected = extractedPoints.filter(p => p.selected).length

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

      {/* 提取按钮 */}
      <View className="p-4">
        <Button 
          onClick={() => setShowExtractDialog(true)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
        >
          <Link2 size={18} color="#FFFFFF" className="mr-2" />
          <Text className="block">粘贴链接提取灵感</Text>
        </Button>
      </View>

      {loading ? (
        <View className="flex justify-center py-20">
          <Text className="block text-gray-400">加载中...</Text>
        </View>
      ) : groupedData.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-16 px-4">
          <View className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <MapPin size={40} color="#9CA3AF" />
          </View>
          <Text className="block text-gray-600 text-center mb-2">
            还没有收录任何灵感点
          </Text>
          <Text className="block text-gray-400 text-sm text-center">
            点击上方按钮粘贴链接提取灵感
          </Text>
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
                    checked={group.items.length > 0 && group.items.every(item => selectedIds.has(item.id!))}
                    className={group.tagBgColor}
                  />
                </View>
                <View className={`w-8 h-8 rounded-lg ${group.tagBgColor} flex items-center justify-center mr-2`}>
                  {group.tag === '景点' ? (
                    <MapPin size={16} color="#3B82F6" />
                  ) : (
                    <Utensils size={16} color="#F59E0B" />
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
                    className={`bg-white ${selectedIds.has(item.id!) ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => toggleItem(item.id!)}
                  >
                    <CardContent className="p-3 flex items-start">
                      <View className="mt-1 mr-3">
                        <Checkbox 
                          checked={selectedIds.has(item.id!)}
                        />
                      </View>
                      <View className="flex-1">
                        <View className="flex items-start justify-between">
                          <Text className="block text-sm font-medium text-gray-900">
                            {item.name}
                          </Text>
                          {item.secondary_tag && (
                            <Badge className={`text-xs ${group.tagBgColor} ${group.tagColor}`}>
                              {item.secondary_tag}
                            </Badge>
                          )}
                        </View>
                        {item.location && (
                          <Text className="block text-xs text-gray-400 mt-1">
                            {item.location}
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

      {/* 链接提取弹窗 */}
      {showExtractDialog && (
        <View className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end">
          <View className="bg-white rounded-t-2xl w-full max-h-[85vh] flex flex-col">
            {/* 弹窗头部 */}
            <View className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <Text className="block text-lg font-semibold text-gray-900">
                提取灵感点
              </Text>
              <View 
                onClick={() => {
                  setShowExtractDialog(false)
                  setLinkInput('')
                  setExtractedPoints([])
                }}
                className="p-2 -mr-2"
              >
                <X size={20} color="#9CA3AF" />
              </View>
            </View>

            {/* 输入区域 */}
            <View className="p-4 border-b border-gray-100">
              <Text className="block text-sm text-gray-500 mb-2">
                粘贴小红书/大众点评链接，或直接输入文字描述
              </Text>
              <View className="bg-gray-50 rounded-xl px-4 py-3">
                <Input
                  placeholder="粘贴链接或输入文字..."
                  value={linkInput}
                  onInput={(e: any) => setLinkInput(e.detail.value)}
                  className="w-full text-sm"
                />
              </View>
              <Button 
                onClick={handleExtractByLink}
                disabled={extracting || !linkInput.trim()}
                className="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Text className="block">{previewLoading ? '提取中...' : (extracting ? '处理中...' : '提取灵感点')}</Text>
              </Button>
            </View>

            {/* 提取结果预览 */}
            {extractedPoints.length > 0 && (
              <View className="flex-1 overflow-y-auto p-4">
                <View className="flex items-center justify-between mb-3">
                  <Text className="block font-medium text-gray-900">
                    提取到 {extractedPoints.length} 个灵感点
                  </Text>
                  <Button 
                    onClick={toggleExtractedAll}
                    size="sm"
                    variant="ghost"
                    className="text-blue-500"
                  >
                    <Text className="block text-sm">
                      {extractedPoints.every(p => p.selected) ? '取消全选' : '全选'}
                    </Text>
                  </Button>
                </View>
                
                <View className="space-y-2">
                  {extractedPoints.map((point, index) => (
                    <Card 
                      key={index}
                      className={`bg-white ${point.selected ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => toggleExtractedPoint(index)}
                    >
                      <CardContent className="p-3 flex items-start">
                        <View className="mt-1 mr-3">
                          <Checkbox checked={point.selected} />
                        </View>
                        <View className="flex-1">
                          <View className="flex items-start justify-between">
                            <Text className="block text-sm font-medium text-gray-900">
                              {point.name}
                            </Text>
                            <Badge className={`text-xs ${point.primary_tag === '景点' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                              {point.primary_tag}
                            </Badge>
                          </View>
                          {point.secondary_tag && (
                            <Text className="block text-xs text-gray-400 mt-1">
                              {point.secondary_tag}
                            </Text>
                          )}
                          {point.location && (
                            <Text className="block text-xs text-gray-400 mt-1">
                              {point.location}
                            </Text>
                          )}
                          {point.description && (
                            <Text className="block text-xs text-gray-500 mt-1 line-clamp-2">
                              {point.description}
                            </Text>
                          )}
                        </View>
                      </CardContent>
                    </Card>
                  ))}
                </View>
              </View>
            )}

            {/* 底部保存按钮 */}
            {extractedPoints.length > 0 && (
              <View className="p-4 border-t border-gray-100">
                <Button 
                  onClick={handleSaveExtracted}
                  disabled={extractedSelected === 0}
                  className={`w-full ${extractedSelected > 0 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300'} text-white`}
                >
                  <Plus size={18} color="#FFFFFF" className="mr-1" />
                  <Text className="block">收录 {extractedSelected} 个灵感点</Text>
                </Button>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
