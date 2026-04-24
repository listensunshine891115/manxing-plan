import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { X } from 'lucide-react-taro'
import './share-sheet.css'

interface ShareSheetProps {
  open: boolean
  onClose: () => void
  content: {
    url: string
    title: string
    image?: string
    type?: 'spot' | 'food' | 'show' | 'hotel'
  } | null
  onCollect: () => void
}

const typeConfig = {
  spot: { color: '#3B82F6', label: '景点' },
  food: { color: '#F59E0B', label: '美食' },
  show: { color: '#8B5CF6', label: '演出' },
  hotel: { color: '#10B981', label: '住宿' }
}

export function ShareSheet({ open, onClose, content, onCollect }: ShareSheetProps) {
  const type = content?.type || 'spot'
  
  if (!open) return null
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <View className="share-sheet-content">
        {/* 关闭按钮 */}
        <View className="absolute top-3 right-3 z-10">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={20} color="#64748B" />
          </Button>
        </View>

        {/* 标题 */}
        <Text className="block text-lg font-semibold text-foreground mb-4 text-center">
          收藏到灵感池
        </Text>

        {/* 内容预览 */}
        {content && (
          <View className="share-sheet-preview bg-surface rounded-xl p-3 mb-6">
            {content.image && (
              <View className="w-full h-40 bg-muted rounded-lg mb-3" />
            )}
            <View className="flex items-center gap-2 mb-2">
              <Badge style={{ backgroundColor: typeConfig[type].color }}>
                {typeConfig[type].label}
              </Badge>
            </View>
            <Text className="block text-sm text-foreground">
              {content.title || '未获取到标题'}
            </Text>
            {content.url && (
              <Text className="block text-xs text-muted-foreground mt-2 truncate">
                {content.url}
              </Text>
            )}
          </View>
        )}

        {/* 操作按钮 */}
        <View className="flex flex-col gap-3">
          <Button 
            className="w-full h-12 text-base font-medium"
            onClick={onCollect}
          >
            收藏到灵感池
          </Button>
          <Button 
            variant="outline"
            className="w-full h-12 text-base"
            onClick={onClose}
          >
            继续浏览
          </Button>
        </View>

        {/* 提示 */}
        <Text className="block text-xs text-muted-foreground text-center mt-4">
          支持从小红书、大众点评、大麦等平台导入
        </Text>
      </View>
    </Dialog>
  )
}
