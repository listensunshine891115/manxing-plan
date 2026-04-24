import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Network } from '@/network'
import { MapPin, Utensils, Plus, Trash2, Package, Clock, DollarSign, Check, X } from 'lucide-react-taro'
import './index.config'

interface InspirationPoint {
  id: string
  name: string
  primary_tag: string
  secondary_tag: string
  location: string
  time: string
  price: string
  description: string
  sourceUrl?: string
  tags?: string[]
  selected: boolean
}

export default function Index() {
  const [userInfo, setUserInfo] = useState<any>(null)
  const [showPasteDialog, setShowPasteDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [pasting, setPasting] = useState(false)
  
  // 预览相关
  const [previewPoints, setPreviewPoints] = useState<InspirationPoint[]>([])
  
  // 灵感库
  const [inspirations, setInspirations] = useState<any[]>([])
  
  // 分类统计
  const [categoryStats, setCategoryStats] = useState<{tag: string, count: number, color: string}[]>([])

  useEffect(() => {
    const info = Taro.getStorageSync('userInfo')
    if (info?.id) {
      setUserInfo(info)
      fetchInspirations()
    } else {
      createTempUser()
    }
  }, [])

  const createTempUser = async () => {
    const tempId = `user_${Date.now()}`
    const tempUser = { id: tempId, name: '旅行者', avatar: '' }
    Taro.setStorageSync('userInfo', tempUser)
    setUserInfo(tempUser)
    fetchInspirations()
  }

  const fetchInspirations = async () => {
    try {
      const res = await Network.request({
        url: '/api/trip/inspirations',
        method: 'GET'
      })
      if (res.data?.success) {
        setInspirations(res.data.data || [])
        updateCategoryStats(res.data.data || [])
      }
    } catch (err) {
      console.error('[Index] 获取灵感库失败:', err)
    }
  }

  const updateCategoryStats = (data: any[]) => {
    const spotCount = data.filter(i => i.primary_tag === '景点').length
    const foodCount = data.filter(i => i.primary_tag === '美食').length
    setCategoryStats([
      { tag: '景点', count: spotCount, color: 'blue' },
      { tag: '美食', count: foodCount, color: 'orange' }
    ])
  }

  // 粘贴链接收录
  const handlePasteLink = async () => {
    if (!linkInput.trim()) {
      Taro.showToast({ title: '请输入链接或文字', icon: 'none' })
      return
    }

    const isUrl = linkInput.includes('http://') || linkInput.includes('https://')

    setPasting(true)
    try {
      Taro.showLoading({ title: '正在提取灵感...' })
      
      const previewRes = await Network.request({
        url: '/api/trip/preview',
        method: 'POST',
        data: {
          userId: userInfo?.id,
          url: isUrl ? linkInput.trim() : undefined,
          text: !isUrl ? linkInput.trim() : undefined
        },
        timeout: 120000
      })
      
      Taro.hideLoading()
      console.log('[Paste] 预览响应:', previewRes.data)
      
      if (previewRes.data?.success && previewRes.data?.data?.inspirationPoints?.length > 0) {
        const points = previewRes.data.data.inspirationPoints.map((p: any) => ({
          ...p,
          selected: true
        }))
        setPreviewPoints(points)
        setShowPasteDialog(false)
        setShowPreviewDialog(true)
        setLinkInput('')
      } else {
        Taro.showToast({ title: previewRes.data?.message || '未能提取到灵感点', icon: 'none' })
      }
    } catch (error: any) {
      Taro.hideLoading()
      console.error('[Paste] 预览失败:', error)
      const errorMsg = error.message || ''
      if (errorMsg.includes('abort') || errorMsg.includes('timeout') || errorMsg.includes('超时')) {
        Taro.showToast({ title: '请求超时，请重试或检查网络', icon: 'none' })
      } else {
        Taro.showToast({ title: '预览失败: ' + errorMsg, icon: 'none' })
      }
    } finally {
      setPasting(false)
    }
  }

  // 切换预览中灵感点的选中状态
  const togglePreviewPoint = (index: number) => {
    const newPoints = [...previewPoints]
    newPoints[index].selected = !newPoints[index].selected
    setPreviewPoints(newPoints)
  }

  // 全选/取消全选预览中的灵感点
  const togglePreviewAll = () => {
    const allSelected = previewPoints.every(p => p.selected)
    setPreviewPoints(previewPoints.map(p => ({ ...p, selected: !allSelected })))
  }

  // 保存选中的灵感点
  const saveSelectedPoints = async () => {
    const selectedPoints = previewPoints.filter(p => p.selected)
    if (selectedPoints.length === 0) {
      Taro.showToast({ title: '请至少选择一项', icon: 'none' })
      return
    }

    try {
      Taro.showLoading({ title: '正在收录...' })
      
      const items = selectedPoints.map(p => ({
        user_id: userInfo?.id,
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
        Taro.showToast({ title: `已收录 ${selectedPoints.length} 个灵感点`, icon: 'success' })
        setShowPreviewDialog(false)
        setPreviewPoints([])
        fetchInspirations()
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      console.error('[Save] 保存失败:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  // 删除灵感点
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
            fetchInspirations()
          } catch {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  // 获取某分类的灵感点
  const getInspirationsByTag = (tag: string) => {
    return inspirations.filter(i => i.primary_tag === tag)
  }

  const selectedCount = previewPoints.filter(p => p.selected).length

  return (
    <View className="min-h-screen bg-gray-50 pb-32">
      {/* 顶部标题 */}
      <View className="bg-white px-4 pt-12 pb-4">
        <Text className="block text-2xl font-bold text-gray-900">
          此刻与你漫行
        </Text>
        <Text className="block text-sm text-gray-500 mt-1">
          收藏旅行灵感，规划完美路线
        </Text>
      </View>

      {/* 收录入口 */}
      <View className="p-4">
        <Button 
          onClick={() => setShowPasteDialog(true)}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-4 rounded-xl shadow-lg"
        >
          <Plus size={24} color="#FFFFFF" className="mr-3" />
          <View>
            <Text className="block text-lg font-semibold">粘贴链接提取灵感</Text>
            <Text className="block text-sm text-blue-100 mt-1">小红书/大众点评/文字描述</Text>
          </View>
        </Button>
      </View>

      {/* 分类统计 */}
      {categoryStats.length > 0 && (
        <View className="px-4 pb-4">
          <View className="flex gap-3">
            {categoryStats.map(stat => (
              <View 
                key={stat.tag}
                onClick={() => setShowCategoryDialog(true)}
                className={`flex-1 bg-${stat.color}-50 border border-${stat.color}-100 rounded-xl p-3 flex items-center justify-center cursor-pointer`}
              >
                <View className="flex items-center">
                  {stat.tag === '景点' ? (
                    <MapPin size={20} color="#3B82F6" />
                  ) : (
                    <Utensils size={20} color="#F59E0B" />
                  )}
                  <Text className={`ml-2 font-medium text-${stat.color}-600`}>
                    {stat.tag}
                  </Text>
                  <Badge className={`ml-2 bg-${stat.color}-100 text-${stat.color}-600`}>
                    {stat.count}
                  </Badge>
                </View>
              </View>
            ))}
          </View>
          <Text className="block text-xs text-gray-400 text-center mt-3">
            共 {inspirations.length} 个灵感点 · 点击查看分类详情
          </Text>
        </View>
      )}

      {/* 灵感库列表 */}
      {inspirations.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-16 px-4">
          <View className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <Package size={40} color="#3B82F6" />
          </View>
          <Text className="block text-gray-600 text-center mb-2">
            还没有收录任何灵感点
          </Text>
          <Text className="block text-gray-400 text-sm text-center">
            点击上方按钮粘贴链接提取灵感
          </Text>
        </View>
      ) : (
        <View className="p-4 space-y-3">
          {inspirations.slice(0, 10).map((item) => (
            <Card key={item.id} className="bg-white">
              <CardContent className="p-4">
                <View className="flex justify-between items-start">
                  <View className="flex-1">
                    <View className="flex items-center mb-2">
                      <Text className="block text-base font-medium text-gray-900">
                        {item.title}
                      </Text>
                      <Badge className={`ml-2 text-xs ${item.primary_tag === '景点' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                        {item.primary_tag}
                      </Badge>
                      {item.secondary_tag && (
                        <Badge className="ml-1 text-xs bg-gray-100 text-gray-500">
                          {item.secondary_tag}
                        </Badge>
                      )}
                    </View>
                    {item.description && (
                      <Text className="block text-sm text-gray-500 mb-2 line-clamp-2">
                        {item.description}
                      </Text>
                    )}
                    <View className="flex flex-wrap gap-3 text-xs text-gray-400">
                      {item.location_name && (
                        <View className="flex items-center">
                          <MapPin size={12} color="#9CA3AF" className="mr-1" />
                          <Text className="block">{item.location_name}</Text>
                        </View>
                      )}
                      {item.time && (
                        <View className="flex items-center">
                          <Clock size={12} color="#9CA3AF" className="mr-1" />
                          <Text className="block">{item.time}</Text>
                        </View>
                      )}
                      {item.price && (
                        <View className="flex items-center">
                          <DollarSign size={12} color="#9CA3AF" className="mr-1" />
                          <Text className="block">{item.price}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 -mr-2 -mt-1"
                  >
                    <Trash2 size={18} color="#9CA3AF" />
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* 粘贴链接弹窗 */}
      {showPasteDialog && (
        <View className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end">
          <View className="bg-white rounded-t-2xl w-full p-4 pb-8">
            <View className="flex justify-between items-center mb-4">
              <Text className="block text-lg font-semibold text-gray-900">
                收录灵感
              </Text>
              <View 
                onClick={() => setShowPasteDialog(false)}
                className="p-2 -mr-2"
              >
                <X size={20} color="#9CA3AF" />
              </View>
            </View>
            
            <Text className="block text-sm text-gray-500 mb-3">
              粘贴小红书/大众点评链接，或直接输入文字描述
            </Text>
            
            <View className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
              <Input
                placeholder="粘贴链接或输入文字..."
                value={linkInput}
                onInput={(e: any) => setLinkInput(e.detail.value)}
                className="w-full text-sm"
              />
            </View>
            
            <Button 
              onClick={handlePasteLink}
              disabled={pasting || !linkInput.trim()}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Text className="block">{pasting ? '提取中...' : '提取灵感点'}</Text>
            </Button>
          </View>
        </View>
      )}

      {/* 预览弹窗 */}
      {showPreviewDialog && (
        <View className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <View className="bg-white rounded-2xl w-full max-h-[80vh] flex flex-col">
            {/* 标题栏 */}
            <View className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <Text className="block text-lg font-semibold text-gray-900">
                预览灵感点
              </Text>
              <View className="flex items-center gap-3">
                <View 
                  onClick={togglePreviewAll}
                  className="flex items-center"
                >
                  <Check size={16} color="#3B82F6" />
                  <Text className="block text-sm text-blue-500 ml-1">
                    {previewPoints.every(p => p.selected) ? '取消全选' : '全选'}
                  </Text>
                </View>
                <View 
                  onClick={() => {
                    setShowPreviewDialog(false)
                    setPreviewPoints([])
                  }}
                  className="p-1"
                >
                  <X size={20} color="#9CA3AF" />
                </View>
              </View>
            </View>
            
            {/* 统计信息 */}
            <View className="px-4 py-2 bg-gray-50">
              <Text className="block text-sm text-gray-500">
                已选择 {selectedCount} / {previewPoints.length} 个灵感点
              </Text>
            </View>
            
            {/* 灵感点列表 */}
            <View className="flex-1 overflow-y-auto p-4 space-y-3">
              {previewPoints.map((point, index) => (
                <Card 
                  key={index}
                  className={`bg-white ${point.selected ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => togglePreviewPoint(index)}
                >
                  <CardContent className="p-4">
                    <View className="flex justify-between items-start">
                      <View className="flex-1">
                        <View className="flex items-center mb-2">
                          <View className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-2 ${point.selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                            {point.selected && <Check size={12} color="#FFFFFF" />}
                          </View>
                          <Text className="block text-base font-medium text-gray-900">
                            {point.name}
                          </Text>
                        </View>
                        <View className="flex items-center mb-2 ml-7">
                          <Badge className={`text-xs ${point.primary_tag === '景点' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                            {point.primary_tag}
                          </Badge>
                          {point.secondary_tag && (
                            <Badge className="ml-1 text-xs bg-gray-100 text-gray-500">
                              {point.secondary_tag}
                            </Badge>
                          )}
                        </View>
                        {point.location && (
                          <View className="flex items-center ml-7 mb-2">
                            <MapPin size={12} color="#9CA3AF" className="mr-1" />
                            <Text className="block text-xs text-gray-400">{point.location}</Text>
                          </View>
                        )}
                        {point.description && (
                          <Text className="block text-sm text-gray-500 ml-7 line-clamp-2">
                            {point.description}
                          </Text>
                        )}
                      </View>
                    </View>
                  </CardContent>
                </Card>
              ))}
            </View>
            
            {/* 底部保存按钮 */}
            <View className="p-4 border-t border-gray-100">
              <Button 
                onClick={saveSelectedPoints}
                disabled={selectedCount === 0}
                className={`w-full ${selectedCount > 0 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300'} text-white`}
              >
                <Text className="block">收录 {selectedCount} 个灵感点</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 分类弹窗 */}
      {showCategoryDialog && (
        <View className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end">
          <View className="bg-white rounded-t-2xl w-full max-h-[70vh] flex flex-col">
            {/* 标题栏 */}
            <View className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <Text className="block text-lg font-semibold text-gray-900">
                灵感库分类
              </Text>
              <View 
                onClick={() => setShowCategoryDialog(false)}
                className="p-2 -mr-2"
              >
                <X size={20} color="#9CA3AF" />
              </View>
            </View>
            
            {/* 分类列表 */}
            <View className="flex-1 overflow-y-auto p-4 space-y-4">
              {categoryStats.map(stat => (
                <View key={stat.tag}>
                  <View className="flex items-center mb-3">
                    <View className={`w-10 h-10 rounded-xl ${stat.color === 'blue' ? 'bg-blue-100' : 'bg-orange-100'} flex items-center justify-center mr-3`}>
                      {stat.tag === '景点' ? (
                        <MapPin size={20} color="#3B82F6" />
                      ) : (
                        <Utensils size={20} color="#F59E0B" />
                      )}
                    </View>
                    <Text className="block text-lg font-medium text-gray-900">
                      {stat.tag}
                    </Text>
                    <Badge className={`ml-2 ${stat.color === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                      {stat.count} 个
                    </Badge>
                  </View>
                  
                  {getInspirationsByTag(stat.tag).length > 0 ? (
                    <View className="space-y-2 ml-13">
                      {getInspirationsByTag(stat.tag).map(item => (
                        <Card key={item.id} className="bg-gray-50">
                          <CardContent className="p-3 flex items-center justify-between">
                            <View className="flex-1">
                              <Text className="block text-sm font-medium text-gray-700">
                                {item.title}
                              </Text>
                              {item.secondary_tag && (
                                <Text className="block text-xs text-gray-400 mt-1">
                                  {item.secondary_tag}
                                </Text>
                              )}
                            </View>
                            <View 
                              onClick={() => handleDelete(item.id)}
                              className="p-2"
                            >
                              <Trash2 size={16} color="#9CA3AF" />
                            </View>
                          </CardContent>
                        </Card>
                      ))}
                    </View>
                  ) : (
                    <Text className="block text-sm text-gray-400 ml-13">
                      暂无{stat.tag}灵感点
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
