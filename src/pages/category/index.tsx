import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro, { useRouter } from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Network } from '@/network'
import { MapPin, Clock, DollarSign, Trash2, Plus, ArrowLeft } from 'lucide-react-taro'
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
  original_url: string
  tags: string[]
}

const CategoryPage = () => {
  const router = useRouter()
  const [inspirations, setInspirations] = useState<InspirationPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [adding, setAdding] = useState(false)

  // 获取一级标签（景点/美食）作为页面参数
  const primaryTag = router.params.tag || '景点'
  const isSpot = primaryTag === '景点'
  const bgColor = isSpot ? 'bg-blue-50' : 'bg-orange-50'
  const tagColor = isSpot ? 'text-blue-600' : 'text-orange-600'
  const tagBgColor = isSpot ? 'bg-blue-100' : 'bg-orange-100'

  useEffect(() => {
    fetchCategoryInspirations()
  }, [primaryTag])

  const fetchCategoryInspirations = async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: '/api/trip/inspirations',
        method: 'GET',
        data: { primaryTag }
      })
      console.log('[Category] 获取灵感:', res.data)
      if (res.data?.success) {
        setInspirations(res.data.data || [])
      }
    } catch (err) {
      console.error('[Category] 获取失败:', err)
    } finally {
      setLoading(false)
    }
  }

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
            fetchCategoryInspirations()
          } catch {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handleAddByLink = async () => {
    if (!linkInput.trim()) {
      Taro.showToast({ title: '请输入链接或文字', icon: 'none' })
      return
    }

    setAdding(true)
    try {
      const isUrl = linkInput.includes('http://') || linkInput.includes('https://')
      
      Taro.showLoading({ title: '正在提取...' })
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
      Taro.hideLoading()

      console.log('[Category] 预览响应:', res.data)

      if (res.data?.success && res.data?.data?.inspirationPoints?.length > 0) {
        // 直接保存该大类的灵感点
        const points = res.data.data.inspirationPoints
          .filter((p: any) => p.primary_tag === primaryTag) // 只保存当前大类
          .map((p: any) => ({
            user_id: Taro.getStorageSync('userInfo')?.id,
            title: p.name,
            source: 'xiaohongshu',
            primary_tag: primaryTag,
            secondary_tag: p.secondary_tag || '',
            location_name: p.location || '',
            time: p.time || '',
            price: p.price || '',
            description: p.description || '',
            original_url: p.sourceUrl || '',
            tags: p.tags || []
          }))

        if (points.length === 0) {
          Taro.showToast({ title: `没有${primaryTag}类灵感点`, icon: 'none' })
          setAdding(false)
          return
        }

        Taro.showLoading({ title: '正在收录...' })
        const saveRes = await Network.request({
          url: '/api/trip/inspirations/batch',
          method: 'POST',
          data: { items: points }
        })
        Taro.hideLoading()

        if (saveRes.data?.code === 200 || saveRes.data?.success) {
          Taro.showToast({ title: `已收录 ${points.length} 个`, icon: 'success' })
          setShowAddDialog(false)
          setLinkInput('')
          fetchCategoryInspirations()
        } else {
          Taro.showToast({ title: '收录失败', icon: 'none' })
        }
      } else {
        Taro.showToast({ title: res.data?.message || '未能提取到灵感点', icon: 'none' })
      }
    } catch (err: any) {
      Taro.hideLoading()
      console.error('[Category] 添加失败:', err)
      Taro.showToast({ title: '添加失败: ' + (err.message || ''), icon: 'none' })
    } finally {
      setAdding(false)
    }
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部标题 */}
      <View className="bg-white px-4 py-3 flex items-center border-b border-gray-100">
        <View onClick={() => Taro.navigateBack()} className="p-2 -ml-2">
          <ArrowLeft size={20} color="#374151" />
        </View>
        <Text className="block text-lg font-semibold text-gray-900 ml-2">
          {primaryTag}
        </Text>
        <Badge className={`ml-auto ${tagBgColor} ${tagColor}`}>
          {inspirations.length} 个
        </Badge>
      </View>

      {/* 二级分类筛选 */}
      {loading ? (
        <View className="flex justify-center py-20">
          <Text className="block text-gray-400">加载中...</Text>
        </View>
      ) : inspirations.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-20 px-4">
          <View className={`w-20 h-20 rounded-full ${bgColor} flex items-center justify-center mb-4`}>
            <MapPin size={40} color={isSpot ? '#3B82F6' : '#F59E0B'} />
          </View>
          <Text className="block text-gray-600 text-center mb-2">
            还没有{primaryTag}灵感点
          </Text>
          <Text className="block text-gray-400 text-sm text-center mb-6">
            点击下方按钮收录灵感
          </Text>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus size={18} color="#FFFFFF" className="mr-1" />
            <Text className="block">收录灵感</Text>
          </Button>
        </View>
      ) : (
        <View className="p-4 space-y-3">
          {inspirations.map((item) => (
            <Card key={item.id} className="bg-white">
              <CardContent className="p-4">
                <View className="flex justify-between items-start">
                  <View className="flex-1">
                    <Text className="block text-base font-medium text-gray-900 mb-2">
                      {item.title}
                    </Text>
                    <Badge className={`${tagBgColor} ${tagColor} mb-2`}>
                      {item.secondary_tag || primaryTag}
                    </Badge>
                  </View>
                  <View 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 -mr-2 -mt-1"
                  >
                    <Trash2 size={18} color="#9CA3AF" />
                  </View>
                </View>
                
                {item.description && (
                  <Text className="block text-sm text-gray-500 mb-3 line-clamp-2">
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
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* 底部添加按钮 */}
      {inspirations.length > 0 && (
        <View className="fixed bottom-4 left-4 right-4">
          <Button 
            onClick={() => setShowAddDialog(true)}
            className={`w-full ${isSpot ? 'bg-blue-500 hover:bg-blue-600' : 'bg-orange-500 hover:bg-orange-600'} text-white`}
          >
            <Plus size={18} color="#FFFFFF" className="mr-1" />
            <Text className="block">收录更多{primaryTag}</Text>
          </Button>
        </View>
      )}

      {/* 添加弹窗 */}
      {showAddDialog && (
        <View className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end">
          <View className="bg-white rounded-t-2xl w-full p-4 pb-8">
            <View className="flex justify-between items-center mb-4">
              <Text className="block text-lg font-semibold">收录{primaryTag}灵感</Text>
              <View 
                onClick={() => setShowAddDialog(false)}
                className="p-2 -mr-2"
              >
                <Text className="block text-gray-400 text-xl">×</Text>
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
            
            <View className="flex items-center">
              <View style={{ flex: 1 }}>
                <Button 
                  onClick={handleAddByLink}
                  disabled={adding}
                  className={`w-full ${isSpot ? 'bg-blue-500 hover:bg-blue-600' : 'bg-orange-500 hover:bg-orange-600'} text-white`}
                >
                  <Text className="block">{adding ? '提取中...' : '提取并收录'}</Text>
                </Button>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default CategoryPage
