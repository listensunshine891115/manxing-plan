import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ShareSheet } from '@/components/share-sheet'
import { Plus, Sparkles, MapPin } from 'lucide-react-taro'
import { Inspiration } from '@/types'
import { Network } from '@/network'
import './index.css'

const sourceConfig = {
  xiaohongshu: { color: '#FF2442', label: '小红书' },
  dazhong: { color: '#FF6600', label: '大众点评' },
  damai: { color: '#00B51D', label: '大麦' },
  other: { color: '#64748B', label: '其他' }
}

const typeConfig = {
  spot: { color: '#3B82F6', label: '景点' },
  food: { color: '#F59E0B', label: '美食' },
  show: { color: '#8B5CF6', label: '演出' },
  hotel: { color: '#10B981', label: '住宿' }
}

export default function Index() {
  const [inspirations, setInspirations] = useState<Inspiration[]>([])
  const [loading, setLoading] = useState(true)
  const [showShareSheet, setShowShareSheet] = useState(false)

  // 加载灵感列表
  const fetchInspirations = async () => {
    try {
      const res = await Network.request({
        url: '/api/trip/inspirations'
      })
      console.log('[GET] /api/trip/inspirations - Response:', JSON.stringify(res.data))
      if (res.data?.data) {
        setInspirations(res.data.data)
      }
    } catch (error) {
      console.error('获取灵感失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInspirations()
  }, [])

  // 打开添加弹窗
  const handleOpenAdd = () => {
    setShowShareSheet(true)
  }

  // 收藏灵感
  const handleCollect = async (data: { url: string; title: string; type?: 'spot' | 'food' | 'show' | 'hotel' }) => {
    try {
      // 根据URL判断来源
      let source = 'other'
      const url = data.url.toLowerCase()
      if (url.includes('xiaohongshu') || url.includes('xhs')) {
        source = 'xiaohongshu'
      } else if (url.includes('dianping') || url.includes('大众点评')) {
        source = 'dazhong'
      } else if (url.includes('damai') || url.includes('大麦')) {
        source = 'damai'
      }

      const res = await Network.request({
        url: '/api/trip/inspirations',
        method: 'POST',
        data: {
          title: data.title,
          image: '',
          source,
          type: data.type || 'spot'
        }
      })
      console.log('[POST] /api/trip/inspirations - Response:', JSON.stringify(res.data))
      
      if (res.data?.data) {
        setInspirations(prev => [res.data.data, ...prev])
      }
    } catch (error) {
      console.error('收藏失败:', error)
    }
  }

  // 删除灵感
  const handleDelete = async (id: string) => {
    try {
      const res = await Network.request({
        url: `/api/trip/inspirations/${id}`,
        method: 'DELETE'
      })
      console.log(`[DELETE] /api/trip/inspirations/${id} - Response:`, JSON.stringify(res.data))
      setInspirations(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  // 生成路线
  const handleGenerate = () => {
    if (inspirations.length === 0) {
      return
    }
    // 跳转到生成设置页
    window.location.href = '/pages/generate/index'
  }

  return (
    <View className="min-h-screen bg-background pb-24">
      {/* 顶部导航 */}
      <View className="sticky top-0 z-10 bg-background px-4 pt-4 pb-3">
        <View className="flex items-center justify-between">
          <Text className="block text-xl font-semibold text-foreground">我的旅行灵感</Text>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleOpenAdd}
          >
            <Plus size={24} color="#3B82F6" />
          </Button>
        </View>
      </View>

      {/* 灵感列表 */}
      <View className="px-4">
        {loading ? (
          <View className="waterfall-grid">
            {[1, 2, 3, 4].map(i => (
              <View key={i} className="card-wrapper">
                <Card className="overflow-hidden">
                  <Skeleton className="h-40 w-full rounded-none" />
                  <CardContent className="p-3">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              </View>
            ))}
          </View>
        ) : inspirations.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-20">
            <View className="mb-4 rounded-full bg-muted p-4">
              <Sparkles size={48} color="#94A3B8" />
            </View>
            <Text className="block text-base text-muted-foreground mb-2">暂无灵感</Text>
            <Text className="block text-sm text-muted-foreground">点击右上角添加旅行目的地吧</Text>
          </View>
        ) : (
          <View className="waterfall-grid">
            {inspirations.map(item => (
              <View key={item.id} className="card-wrapper">
                <Card 
                  className="overflow-hidden card-item"
                  onLongPress={() => handleDelete(item.id)}
                >
                  <View className="relative">
                    {item.image && (
                      <Image 
                        src={item.image} 
                        className="w-full h-40 object-cover"
                        mode="aspectFill"
                      />
                    )}
                    <View 
                      className="absolute top-2 right-2 px-2 py-1 rounded text-xs text-white"
                      style={{ backgroundColor: sourceConfig[item.source as keyof typeof sourceConfig]?.color || '#64748B' }}
                    >
                      {sourceConfig[item.source as keyof typeof sourceConfig]?.label || '其他'}
                    </View>
                    <Badge 
                      className="absolute bottom-2 left-2"
                      style={{ backgroundColor: typeConfig[item.type as keyof typeof typeConfig]?.color || '#3B82F6' }}
                    >
                      {typeConfig[item.type as keyof typeof typeConfig]?.label || '景点'}
                    </Badge>
                  </View>
                  <CardContent className="p-3">
                    <Text className="block text-sm font-medium text-foreground line-clamp-2 mb-1">
                      {item.title}
                    </Text>
                    {item.location && (
                      <View className="flex items-center text-xs text-muted-foreground">
                        <MapPin size={12} color="#94A3B8" className="mr-1" />
                        <Text className="block truncate">{item.location.name}</Text>
                      </View>
                    )}
                    {item.price && (
                      <Text className="block text-xs text-orange-500 mt-1">
                        ¥{item.price}
                      </Text>
                    )}
                    {item.rating && (
                      <Text className="block text-xs text-yellow-500 mt-1">
                        ⭐ {item.rating / 100}
                      </Text>
                    )}
                  </CardContent>
                </Card>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 底部固定按钮 */}
      <View className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4 pb-8">
        <Button 
          className="w-full h-12 text-base font-medium"
          onClick={handleGenerate}
          disabled={inspirations.length === 0}
        >
          生成路线
        </Button>
        {inspirations.length > 0 && (
          <Text className="block text-center text-xs text-muted-foreground mt-2">
            已收藏 {inspirations.length} 个灵感
          </Text>
        )}
      </View>

      {/* 分享收集弹窗 */}
      <ShareSheet
        open={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        onCollect={handleCollect}
      />
    </View>
  )
}
