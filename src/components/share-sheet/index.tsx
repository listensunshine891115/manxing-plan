import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { X, Link, FileText, ExternalLink } from 'lucide-react-taro'
import './share-sheet.css'

interface ShareSheetProps {
  open: boolean
  onClose: () => void
  onCollect: (data: { url: string; title: string; type?: 'spot' | 'food' | 'show' | 'hotel' }) => void
}

export function ShareSheet({ open, onClose, onCollect }: ShareSheetProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [selectedType, setSelectedType] = useState<'spot' | 'food' | 'show' | 'hotel'>('spot')
  const [loading, setLoading] = useState(false)

  const typeOptions = [
    { value: 'spot' as const, label: '景点', color: '#3B82F6' },
    { value: 'food' as const, label: '美食', color: '#F59E0B' },
    { value: 'show' as const, label: '演出', color: '#8B5CF6' },
    { value: 'hotel' as const, label: '住宿', color: '#10B981' }
  ]

  // 粘贴剪贴板内容
  const handlePaste = async () => {
    try {
      const res = await Taro.getClipboardData({})
      if (res.data) {
        setUrl(res.data)
        // 尝试从URL中提取域名作为标题
        try {
          const urlObj = new URL(res.data)
          const hostname = urlObj.hostname.replace('www.', '')
          setTitle(`来自 ${hostname} 的分享`)
        } catch {
          // URL解析失败，保持原样
        }
      }
    } catch (error) {
      console.error('粘贴失败:', error)
    }
  }

  // 解析链接自动识别类型
  const detectType = (inputUrl: string) => {
    const lowerUrl = inputUrl.toLowerCase()
    if (lowerUrl.includes('xiaohongshu') || lowerUrl.includes('xhs')) {
      return 'spot'
    }
    if (lowerUrl.includes('大众点评') || lowerUrl.includes('dianping')) {
      return 'food'
    }
    if (lowerUrl.includes('大麦') || lowerUrl.includes('damai')) {
      return 'show'
    }
    if (lowerUrl.includes('酒店') || lowerUrl.includes('hotel') || lowerUrl.includes('民宿')) {
      return 'hotel'
    }
    return 'spot'
  }

  // 处理URL输入变化
  const handleUrlChange = (value: string) => {
    setUrl(value)
    // 自动识别类型
    if (value) {
      setSelectedType(detectType(value))
    }
  }

  // 收藏
  const handleCollect = async () => {
    if (!url.trim()) return
    
    setLoading(true)
    try {
      await onCollect({
        url: url.trim(),
        title: title.trim() || '未命名灵感',
        type: selectedType
      })
      // 清空并关闭
      setUrl('')
      setTitle('')
      setSelectedType('spot')
      onClose()
    } catch (error) {
      console.error('收藏失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 关闭时清空
  const handleClose = () => {
    setUrl('')
    setTitle('')
    setSelectedType('spot')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <View className="share-sheet-content">
        {/* 关闭按钮 */}
        <View className="absolute top-3 right-3 z-10">
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X size={20} color="#64748B" />
          </Button>
        </View>

        {/* 标题 */}
        <View className="flex items-center justify-center mb-6">
          <View className="rounded-full p-2 mr-2" style={{ backgroundColor: '#3B82F6', opacity: 0.1 }}>
            <Link size={20} color="#3B82F6" />
          </View>
          <Text className="block text-lg font-semibold text-foreground">
            添加旅行灵感
          </Text>
        </View>

        {/* 使用说明 */}
        <View className="rounded-xl p-3 mb-4" style={{ backgroundColor: '#EFF6FF' }}>
          <View className="flex items-start">
            <ExternalLink size={16} color="#3B82F6" className="mr-2 mt-1 shrink-0" />
            <Text className="block text-xs leading-relaxed" style={{ color: '#1D4ED8' }}>
              1. 在小红书/大众点评等App{'\n'}
              2. 复制分享链接{'\n'}
              3. 点击下方粘贴按钮
            </Text>
          </View>
        </View>

        {/* 链接输入 */}
        <View className="mb-4">
          <View className="flex items-center justify-between mb-2">
            <Text className="block text-sm font-medium text-foreground">分享链接</Text>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handlePaste}
              className="h-8 px-3"
            >
              <FileText size={14} color="#3B82F6" className="mr-1" />
              <Text className="block text-sm" style={{ color: '#3B82F6' }}>粘贴</Text>
            </Button>
          </View>
          <View className="rounded-xl px-4 py-3" style={{ backgroundColor: '#F1F5F9' }}>
            <Input
              className="w-full bg-transparent text-sm"
              placeholder="粘贴或输入分享链接..."
              value={url}
              onInput={(e: any) => handleUrlChange(e.detail.value)}
              type="text"
            />
          </View>
        </View>

        {/* 标题输入 */}
        <View className="mb-4">
          <Text className="block text-sm font-medium text-foreground mb-2">灵感标题</Text>
          <View className="rounded-xl px-4 py-3" style={{ backgroundColor: '#F1F5F9' }}>
            <Input
              className="w-full bg-transparent text-sm"
              placeholder="给这个灵感起个名字..."
              value={title}
              onInput={(e: any) => setTitle(e.detail.value)}
              type="text"
            />
          </View>
        </View>

        {/* 类型选择 */}
        <View className="mb-6">
          <Text className="block text-sm font-medium text-foreground mb-2">灵感类型</Text>
          <View className="flex gap-2">
            {typeOptions.map((item) => (
              <View
                key={item.value}
                onClick={() => setSelectedType(item.value)}
                className="flex-1 py-2 px-3 rounded-lg text-center transition-all"
                style={{
                  borderWidth: 2,
                  borderColor: selectedType === item.value ? item.color : 'transparent',
                  backgroundColor: selectedType === item.value ? `${item.color}15` : '#F1F5F9',
                  borderStyle: 'solid'
                }}
              >
                <Text
                  className="block text-xs font-medium"
                  style={{ color: selectedType === item.value ? item.color : '#64748B' }}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 操作按钮 */}
        <View className="flex flex-col gap-3">
          <Button
            className="w-full h-12 text-base font-medium"
            onClick={handleCollect}
            disabled={!url.trim() || loading}
          >
            {loading ? '收藏中...' : '收藏到灵感池'}
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={handleClose}
          >
            取消
          </Button>
        </View>
      </View>
    </Dialog>
  )
}
