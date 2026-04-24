import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Network } from '@/network'
import { InspirationCard, InspirationItem } from '@/components/inspiration-card'
import { ArrowLeft, Heart, Sparkles } from 'lucide-react-taro'
import './index.config'

const FavoritesPage = () => {
  const [favorites, setFavorites] = useState<InspirationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchFavorites()
  }, [])

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true)
    await fetchFavorites()
    setRefreshing(false)
    Taro.showToast({ title: '刷新成功', icon: 'success' })
  }

  const fetchFavorites = async () => {
    setLoading(true)
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      const res = await Network.request({
        url: '/api/trip/inspirations/favorites',
        method: 'GET',
        data: { userId: userInfo?.id }
      })
      console.log('[Favorites] 获取收藏:', res.data)
      if (res.data?.data) {
        setFavorites(res.data.data)
      }
    } catch (err) {
      console.error('[Favorites] 获取失败:', err)
    } finally {
      setLoading(false)
    }
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
      // 刷新列表
      fetchFavorites()
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
            fetchFavorites()
          } catch {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部标题 */}
      <View className="bg-white px-4 py-3 flex items-center border-b border-gray-100">
        <View onClick={() => Taro.navigateBack()} className="p-2 -ml-2">
          <ArrowLeft size={20} color="#374151" />
        </View>
        <View className="flex items-center ml-2">
          <Heart size={18} color="#ef4444" />
          <Text className="block text-lg font-semibold text-gray-900 ml-2">我的收藏</Text>
        </View>
        <Badge variant="secondary" className="ml-auto">
          {favorites.length} 个
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
        {!loading && favorites.length === 0 && (
          <View className="flex flex-col items-center justify-center py-20 px-4">
            <View className="w-20 h-20 bg-gradient-to-br from-red-50 to-pink-50 rounded-full flex items-center justify-center mb-4 border border-red-100">
              <Heart size={40} color="#ef4444" />
            </View>
            <Text className="block text-lg font-semibold text-gray-900 mb-2">
              还没有收藏的灵感点
            </Text>
            <Text className="block text-sm text-gray-500 text-center mb-6">
              收藏你喜欢的灵感点，方便下次快速找到
            </Text>
            <Button 
              className="bg-gradient-to-r from-red-500 to-pink-500"
              onClick={() => Taro.navigateBack()}
            >
              <Sparkles size={16} color="#fff" />
              <Text className="text-white ml-2">去收集灵感</Text>
            </Button>
          </View>
        )}

        {/* 收藏列表 */}
        {!loading && favorites.length > 0 && (
          <View className="p-4 space-y-3">
            {favorites.map((inspiration) => (
              <InspirationCard
                key={inspiration.id}
                item={inspiration}
                onFavorite={handleFavorite}
                onDelete={handleDelete}
                onClick={(ins) => {
                  if (ins.original_url) {
                    Taro.setClipboardData({ data: ins.original_url })
                    Taro.showToast({ title: '链接已复制', icon: 'success' })
                  }
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

export default FavoritesPage
