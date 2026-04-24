import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Network } from '@/network'
import { InspirationCard, InspirationItem } from '@/components/inspiration-card'
import { ArrowLeft, Heart } from 'lucide-react-taro'
import './index.config'

const FavoritesPage = () => {
  const [favorites, setFavorites] = useState<InspirationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFavorites()
  }, [])

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

      {/* 收藏列表 */}
      {loading ? (
        <View className="flex justify-center py-20">
          <Text className="block text-gray-400">加载中...</Text>
        </View>
      ) : favorites.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-20 px-4">
          <View className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <Heart size={40} color="#ef4444" />
          </View>
          <Text className="block text-gray-600 text-center mb-2">
            还没有收藏的灵感点
          </Text>
          <Text className="block text-gray-400 text-sm text-center mb-6">
            点击灵感点上的{'\n'}收藏按钮即可收藏
          </Text>
          <Button onClick={() => Taro.navigateBack()}>
            <Text className="block">去收集灵感</Text>
          </Button>
        </View>
      ) : (
        <View className="p-4 space-y-3">
          {favorites.map((inspiration) => (
            <InspirationCard
              key={inspiration.id}
              item={inspiration}
              onFavorite={handleFavorite}
              onDelete={handleDelete}
              onClick={(ins) => {
                // 可以跳转到详情页
                if (ins.original_url) {
                  Taro.setClipboardData({ data: ins.original_url })
                  Taro.showToast({ title: '链接已复制', icon: 'success' })
                }
              }}
            />
          ))}
        </View>
      )}
    </View>
  )
}

export default FavoritesPage
