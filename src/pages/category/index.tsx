import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import Taro, { useRouter } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Network } from '@/network'
import { InspirationCard, InspirationItem } from '@/components/inspiration-card'
import { Plus, ArrowLeft, Sparkles } from 'lucide-react-taro'
import './index.config'

const CategoryPage = () => {
  const router = useRouter()
  const [inspirations, setInspirations] = useState<InspirationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [adding, setAdding] = useState(false)

  // 获取一级标签（景点/美食）作为页面参数
  const primaryTag = router.params.tag || '景点'

  useEffect(() => {
    fetchCategoryInspirations()
  }, [primaryTag])

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true)
    await fetchCategoryInspirations()
    setRefreshing(false)
    Taro.showToast({ title: '刷新成功', icon: 'success' })
  }

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
    if (id === 'refresh') {
      fetchCategoryInspirations()
      return
    }
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

  // 处理收藏
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
      fetchCategoryInspirations()
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
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
        <Badge variant="secondary" className="ml-auto">
          {inspirations.length} 个
        </Badge>
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
        {!loading && inspirations.length === 0 && (
          <View className="flex flex-col items-center justify-center py-20 px-4">
            <View className="w-20 h-20 bg-gradient-to-br from-blue-50 to-green-50 rounded-full flex items-center justify-center mb-4 border border-blue-100">
              <Sparkles size={40} color="#3b82f6" />
            </View>
            <Text className="block text-lg font-semibold text-gray-900 mb-2">
              还没有{primaryTag}灵感点
            </Text>
            <Text className="block text-sm text-gray-500 text-center mb-6">
              收录你感兴趣的{primaryTag}，方便规划路线
            </Text>
            <Button 
              className="bg-gradient-to-r from-blue-500 to-blue-600"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus size={16} color="#fff" />
              <Text className="text-white ml-2">收录灵感</Text>
            </Button>
          </View>
        )}

        {/* 灵感点列表 */}
        {!loading && inspirations.length > 0 && (
          <View className="p-4 space-y-3">
            {inspirations.map((item) => (
              <InspirationCard
                key={item.id}
                item={item}
                onDelete={handleDelete}
                onFavorite={handleFavorite}
                onClick={() => {
                  if (item.original_url) {
                    Taro.setClipboardData({ data: item.original_url })
                    Taro.showToast({ title: '链接已复制', icon: 'success' })
                  }
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* 底部添加按钮 */}
      {inspirations.length > 0 && (
        <View className="fixed bottom-4 left-4 right-4">
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
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
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
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
