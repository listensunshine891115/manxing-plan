import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Network } from '@/network'
import { MapPin, Clock, DollarSign, Trash2, Heart, Check, ChevronRight } from 'lucide-react-taro'
import Taro from '@tarojs/taro'
import { primaryTagConfig } from '@/pages/index/config'

// 灵感点类型
export interface InspirationItem {
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
  is_favorite?: boolean
}

// 卡片属性
interface InspirationCardProps {
  item: InspirationItem
  onDelete?: (id: string) => void
  onFavorite?: (id: string, isFavorite: boolean) => void
  showSelect?: boolean
  selected?: boolean
  onSelect?: (id: string) => void
  onClick?: (item: InspirationItem) => void
}

export const InspirationCard: React.FC<InspirationCardProps> = ({
  item,
  onDelete,
  onFavorite,
  showSelect = false,
  selected = false,
  onSelect,
  onClick
}) => {
  // 获取标签配置
  const tagConfig = primaryTagConfig[item.primary_tag] || primaryTagConfig['景点']
  
  // 处理收藏
  const handleFavorite = async (e: any) => {
    e?.stopPropagation?.()
    if (!onFavorite) {
      // 默认收藏逻辑
      try {
        await Network.request({
          url: `/api/trip/inspirations/${item.id}/favorite`,
          method: 'POST',
          data: { isFavorite: !item.is_favorite }
        })
        Taro.showToast({ 
          title: item.is_favorite ? '已取消收藏' : '已收藏', 
          icon: 'success' 
        })
        // 触发刷新
        if (onDelete) {
          onDelete('refresh')
        }
      } catch {
        Taro.showToast({ title: '操作失败', icon: 'none' })
      }
    } else {
      onFavorite(item.id, !item.is_favorite)
    }
  }
  
  // 处理删除
  const handleDelete = async (e: any) => {
    e?.stopPropagation?.()
    
    if (onDelete) {
      onDelete(item.id)
      return
    }
    
    // 默认删除逻辑
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这个灵感点吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/trip/inspirations/${item.id}`,
              method: 'DELETE'
            })
            Taro.showToast({ title: '已删除', icon: 'success' })
          } catch {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
  
  // 处理选择
  const handleSelect = (e: any) => {
    e?.stopPropagation?.()
    onSelect?.(item.id)
  }
  
  return (
    <Card 
      className={`bg-white overflow-hidden transition-all ${selected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
      onClick={() => onClick?.(item)}
    >
      <CardContent className="p-4">
        <View className="flex items-start gap-3">
          {/* 选择框 */}
          {showSelect && (
            <View 
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 flex-shrink-0 ${
                selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
              }`}
              onClick={handleSelect}
            >
              {selected && <Check size={14} color="#fff" />}
            </View>
          )}
          
          <View className="flex-1">
            {/* 标题行 */}
            <View className="flex items-start justify-between">
              <Text className="block text-base font-medium text-gray-900 flex-1 pr-2">
                {item.title}
              </Text>
              
              {/* 操作按钮 */}
              <View className="flex items-center gap-2 flex-shrink-0">
                {/* 收藏按钮 */}
                <View 
                  onClick={handleFavorite}
                  className="p-1"
                >
                  <Heart 
                    size={18} 
                    color={item.is_favorite ? '#ef4444' : '#9ca3af'}
                  />
                </View>
                
                {/* 删除按钮 */}
                <View 
                  onClick={handleDelete}
                  className="p-1"
                >
                  <Trash2 size={18} color="#9ca3af" />
                </View>
              </View>
            </View>
            
            {/* 分类标签 */}
            <View className="flex items-center gap-2 mt-2 mb-2">
              <Badge 
                style={{ 
                  backgroundColor: tagConfig.bgColor,
                  color: tagConfig.color
                }}
              >
                {tagConfig.icon} {tagConfig.label}
              </Badge>
              {item.secondary_tag && (
                <Badge variant="secondary">
                  {item.secondary_tag}
                </Badge>
              )}
            </View>
            
            {/* 描述 */}
            {item.description && (
              <Text className="block text-sm text-gray-500 mb-3 line-clamp-2">
                {item.description}
              </Text>
            )}
            
            {/* 信息行 */}
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
            
            {/* 查看详情箭头 */}
            {onClick && (
              <View className="flex items-center justify-end mt-2">
                <Text className="text-xs text-blue-500">查看详情</Text>
                <ChevronRight size={12} color="#3b82f6" />
              </View>
            )}
          </View>
        </View>
      </CardContent>
    </Card>
  )
}

export default InspirationCard
