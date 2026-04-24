import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Network } from '@/network'
import { InspirationCard, InspirationItem } from '@/components/inspiration-card'
import { ArrowLeft, Sparkles, SlidersHorizontal } from 'lucide-react-taro'
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

const SelectPage = () => {
  const [allInspirations, setAllInspirations] = useState<InspirationItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('全部')

  // 分类统计
  const categoryStats: CategoryStat[] = [
    { tag: '景点', ...primaryTagConfig['景点'], count: 0 },
    { tag: '美食', ...primaryTagConfig['美食'], count: 0 },
    { tag: '购物', ...primaryTagConfig['购物'], count: 0 },
    { tag: '活动', ...primaryTagConfig['活动'], count: 0 },
  ]

  useEffect(() => {
    fetchAllInspirations()
  }, [])

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

  // 全选当前分类
  const selectAll = () => {
    const items = activeCategory === '全部' 
      ? allInspirations 
      : allInspirations.filter(i => i.primary_tag === activeCategory)
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      items.forEach(i => newSet.add(i.id))
      return newSet
    })
  }

  // 取消全选当前分类
  const deselectAll = () => {
    const items = activeCategory === '全部' 
      ? allInspirations 
      : allInspirations.filter(i => i.primary_tag === activeCategory)
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      items.forEach(i => newSet.delete(i.id))
      return newSet
    })
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

  // 根据分类筛选
  const filteredInspirations = activeCategory === '全部' 
    ? allInspirations 
    : allInspirations.filter(i => i.primary_tag === activeCategory)

  // 获取分类统计
  const getStats = () => {
    return categoryStats.map(stat => ({
      ...stat,
      count: allInspirations.filter(i => i.primary_tag === stat.tag).length
    }))
  }

  // 获取当前选中分类的标签
  const getCurrentCategoryLabel = () => {
    if (activeCategory === '全部') return '🏠 全部'
    const stat = getStats().find(s => s.tag === activeCategory)
    return stat ? `${stat.icon} ${stat.label}` : '🏠 全部'
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

      {/* 分类筛选 */}
      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <View className="flex items-center gap-3">
          <View className="flex items-center">
            <SlidersHorizontal size={16} color="#6b7280" />
            <Text className="block text-sm text-gray-600 ml-2">筛选：</Text>
          </View>
          
          <View className="flex-1">
            <Select
              value={activeCategory}
              onValueChange={(value) => setActiveCategory(value)}
            >
              <SelectTrigger className="w-32">
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
          
          <View className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              全部 {allInspirations.length}
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
      </View>

      {/* 列表 */}
      {loading ? (
        <View className="flex justify-center py-20">
          <Text className="block text-gray-400">加载中...</Text>
        </View>
      ) : filteredInspirations.length === 0 ? (
        <View className="flex flex-col items-center justify-center py-20 px-4">
          <View className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Sparkles size={40} color="#9ca3af" />
          </View>
          <Text className="block text-gray-600 text-center mb-2">
            {activeCategory === '全部' ? '还没有灵感点' : `还没有${activeCategory}灵感点`}
          </Text>
          <Text className="block text-gray-400 text-sm text-center">
            去首页粘贴链接收录灵感
          </Text>
        </View>
      ) : (
        <View className="p-4 space-y-3">
          {/* 全选/取消全选 */}
          <View className="flex items-center justify-between mb-2">
            <Text className="text-sm text-gray-500">
              {getCurrentCategoryLabel()} · {filteredInspirations.length} 个灵感点
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
