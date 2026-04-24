import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Sparkles, MapPin, Calendar, Target, ChevronRight, Compass } from 'lucide-react-taro'
import { Inspiration } from '@/types'
import { Network } from '@/network'
import './index.css'

const typeConfig = {
  spot: { color: '#3B82F6', label: '景点', icon: '🏛️' },
  food: { color: '#F59E0B', label: '美食', icon: '🍜' },
  show: { color: '#8B5CF6', label: '演出', icon: '🎭' },
  hotel: { color: '#10B981', label: '住宿', icon: '🏨' }
}

const sourceConfig = {
  xiaohongshu: { color: '#FF2442', label: '小红书' },
  dazhong: { color: '#FF6600', label: '大众点评' },
  damai: { color: '#00B51D', label: '大麦' },
  other: { color: '#64748B', label: '其他' }
}

export default function Index() {
  const [inspirations, setInspirations] = useState<Inspiration[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // 模拟当前用户（实际应从登录态获取）
  const userId = 'user_' + Date.now()

  // 加载灵感列表
  const fetchInspirations = async () => {
    try {
      const res = await Network.request({
        url: '/api/trip/inspirations',
        data: { userId }
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

  // 切换选中状态
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  // 全选/取消全选
  const toggleAll = (type: 'spot' | 'food' | 'show' | 'hotel') => {
    const typeIds = inspirations.filter(i => i.type === type).map(i => i.id)
    const allSelected = typeIds.every(id => selectedIds.includes(id))
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !typeIds.includes(id)))
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...typeIds])])
    }
  }

  // 开始规划
  const handleStartPlan = () => {
    if (selectedIds.length === 0) {
      // 没选中任何灵感，全选所有
      setSelectedIds(inspirations.map(i => i.id))
    }
    // 跳转到设置页
    window.location.href = '/pages/generate/index?selected=' + selectedIds.join(',')
  }

  // 按类型分组
  const groupedInspirations = {
    spot: inspirations.filter(i => i.type === 'spot'),
    food: inspirations.filter(i => i.type === 'food'),
    show: inspirations.filter(i => i.type === 'show'),
    hotel: inspirations.filter(i => i.type === 'hotel')
  }

  return (
    <View className="min-h-screen bg-background pb-28">
      {/* 品牌标识区 */}
      <View className="brand-header">
        <View className="brand-logo">
          <Sparkles size={24} color="#3B82F6" />
        </View>
        <Text className="block text-lg font-semibold text-foreground">此刻与你漫行</Text>
        <Text className="block text-xs text-muted-foreground mt-1">勾选灵感，开启旅程</Text>
      </View>

      {/* 快捷入口 */}
      <View className="px-4 mb-4">
        <View className="quick-actions">
          <View className="quick-action-item" onClick={() => window.location.href = '/pages/generate/index'}>
            <View className="quick-action-icon" style={{ backgroundColor: '#EFF6FF' }}>
              <Calendar size={20} color="#3B82F6" />
            </View>
            <Text className="block text-sm font-medium text-foreground">出行设置</Text>
          </View>
          <View className="quick-action-item" onClick={() => window.location.href = '/pages/manage/index'}>
            <View className="quick-action-icon" style={{ backgroundColor: '#FEF3C7' }}>
              <Target size={20} color="#F59E0B" />
            </View>
            <Text className="block text-sm font-medium text-foreground">灵感管理</Text>
          </View>
        </View>
      </View>

      {/* 使用提示 */}
      <View className="px-4 mb-4">
        <View className="tip-card">
          <Compass size={16} color="#10B981" className="mr-2 shrink-0" />
          <Text className="block text-xs text-muted-foreground">
            发送分享链接给账号即可自动收录灵感。勾选下方灵感，开始规划路线。
          </Text>
        </View>
      </View>

      {/* 灵感分类列表 */}
      {(['spot', 'food', 'show', 'hotel'] as const).map(type => {
        const items = groupedInspirations[type]
        if (items.length === 0) return null
        
        const typeInfo = typeConfig[type]
        const allSelected = items.every(i => selectedIds.includes(i.id))
        
        return (
          <View key={type} className="mb-4">
            {/* 类型标题 */}
            <View className="px-4 flex items-center justify-between mb-2">
              <View className="flex items-center">
                <Text className="block mr-2">{typeInfo.icon}</Text>
                <Text className="block text-base font-medium text-foreground">{typeInfo.label}</Text>
                <Badge variant="secondary" className="ml-2 text-xs">{items.length}</Badge>
              </View>
              <View 
                className="flex items-center"
                onClick={() => toggleAll(type)}
              >
                <Checkbox checked={allSelected} className="mr-2" />
                <Text className="block text-xs text-muted-foreground">
                  {allSelected ? '取消全选' : '全选'}
                </Text>
              </View>
            </View>

            {/* 灵感卡片列表 */}
            <View className="px-4 space-y-2">
              {items.map(item => (
                <View 
                  key={item.id}
                  className="inspiration-item"
                  onClick={() => toggleSelect(item.id)}
                >
                  <Checkbox 
                    checked={selectedIds.includes(item.id)} 
                    className="mr-3 shrink-0"
                  />
                  <View className="inspiration-content">
                    <Text className="block text-sm text-foreground line-clamp-1">
                      {item.title}
                    </Text>
                    <View className="flex items-center mt-1">
                      <Text 
                        className="block text-xs"
                        style={{ color: sourceConfig[item.source as keyof typeof sourceConfig]?.color }}
                      >
                        {sourceConfig[item.source as keyof typeof sourceConfig]?.label}
                      </Text>
                      {item.location?.name && (
                        <>
                          <Text className="block text-xs text-muted-foreground mx-1">·</Text>
                          <MapPin size={10} color="#94A3B8" />
                          <Text className="block text-xs text-muted-foreground ml-1 truncate">
                            {item.location.name}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  <ChevronRight size={16} color="#CBD5E1" className="shrink-0" />
                </View>
              ))}
            </View>
          </View>
        )
      })}

      {/* 空状态 */}
      {!loading && inspirations.length === 0 && (
        <View className="empty-state">
          <View className="empty-icon">
            <MapPin size={40} color="#94A3B8" />
          </View>
          <Text className="block text-base font-medium text-foreground mb-2">暂无灵感</Text>
          <Text className="block text-sm text-muted-foreground text-center leading-relaxed">
            发送分享链接给账号即可{'\n'}自动收录到灵感池
          </Text>
        </View>
      )}

      {/* 底部固定操作栏 */}
      <View className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4 pb-8">
        <View className="flex items-center justify-between mb-3">
          <Text className="block text-sm text-muted-foreground">
            已选择 <Text style={{ color: '#3B82F6', fontWeight: 600 }}>{selectedIds.length}</Text> 个灵感
          </Text>
          {selectedIds.length > 0 && (
            <Text 
              className="block text-xs text-primary"
              onClick={() => setSelectedIds([])}
            >
              清空选择
            </Text>
          )}
        </View>
        <Button 
          className="w-full h-12 text-base font-medium"
          onClick={handleStartPlan}
        >
          开始规划
          <ChevronRight size={18} color="#ffffff" className="ml-2" />
        </Button>
      </View>
    </View>
  )
}
