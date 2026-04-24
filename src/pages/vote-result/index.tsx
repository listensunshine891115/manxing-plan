import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Trophy, Check, Clock, MapPin } from 'lucide-react-taro'
import { TripVersion } from '@/types'
import './index.css'

// 模拟投票结果数据
const mockVersions: TripVersion[] = [
  {
    id: 'v1',
    versionName: '经典打卡线',
    voteCount: 3,
    isFinal: false,
    createTime: Date.now(),
    content: [
      { day: 1, date: '2024-01-15', items: [] },
      { day: 2, date: '2024-01-16', items: [] },
      { day: 3, date: '2024-01-17', items: [] }
    ]
  },
  {
    id: 'v2',
    versionName: '文艺休闲线',
    voteCount: 5,
    isFinal: false,
    createTime: Date.now(),
    content: [
      { day: 1, date: '2024-01-15', items: [] },
      { day: 2, date: '2024-01-16', items: [] },
      { day: 3, date: '2024-01-17', items: [] }
    ]
  },
  {
    id: 'v3',
    versionName: '美食探索线',
    voteCount: 2,
    isFinal: false,
    createTime: Date.now(),
    content: [
      { day: 1, date: '2024-01-15', items: [] },
      { day: 2, date: '2024-01-16', items: [] }
    ]
  }
]

export default function VoteResult() {
  const [versions] = useState(mockVersions)
  const [confirmed, setConfirmed] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const totalVotes = versions.reduce((sum, v) => sum + v.voteCount, 0)
  const winner = versions.reduce((max, v) => v.voteCount > max.voteCount ? v : max, versions[0])

  const handleConfirm = async () => {
    if (confirmed) return
    
    setConfirming(true)
    
    try {
      // TODO: 调用后端API确认最终版本
      // await Network.request({
      //   url: '/api/trip/confirm',
      //   method: 'POST',
      //   data: { versionId: winner.id }
      // })
      
      // 模拟确认
      await new Promise(resolve => setTimeout(resolve, 500))
      setConfirmed(true)
    } catch (error) {
      console.error('确认失败:', error)
    } finally {
      setConfirming(false)
    }
  }

  const handleViewRoute = () => {
    window.location.href = '/pages/route/index'
  }

  return (
    <View className="min-h-screen bg-background pb-24">
      {/* 顶部导航 */}
      <View className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <View className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft size={24} color="#1E293B" />
          </Button>
          <Text className="block text-lg font-semibold text-foreground ml-2">投票结果</Text>
        </View>
      </View>

      {/* 投票统计 */}
      <View className="px-4 py-6">
        <View className="bg-gradient-to-r from-primary to-blue-400 rounded-2xl p-6 text-white text-center">
          <Trophy size={48} color="#ffffff" className="mx-auto mb-3" />
          <Text className="block text-2xl font-bold mb-1">
            投票结束
          </Text>
          <Text className="block text-sm opacity-80">
            共 {totalVotes} 人参与投票
          </Text>
        </View>
      </View>

      {/* 获胜版本 */}
      <View className="px-4">
        <View className="winner-card">
          <View className="winner-header">
            <Badge className="bg-warning text-white">
              <Trophy size={12} color="#ffffff" className="mr-1" />
              最高票
            </Badge>
          </View>
          
          <View className="winner-content">
            <Text className="block text-xl font-bold text-foreground mb-2">
              {winner.versionName}
            </Text>
            
            <View className="flex gap-4 mb-4">
              <View className="flex items-center text-sm text-muted-foreground">
                <Clock size={14} color="#94A3B8" className="mr-1" />
                <Text className="block">{winner.content.length}天行程</Text>
              </View>
              <View className="flex items-center text-sm text-muted-foreground">
                <MapPin size={14} color="#94A3B8" className="mr-1" />
                <Text className="block">
                  {winner.content.reduce((sum, day) => sum + day.items.length, 0)}个地点
                </Text>
              </View>
            </View>

            <View className="mb-2">
              <View className="flex justify-between text-sm mb-1">
                <Text className="block text-muted-foreground">得票率</Text>
                <Text className="block text-lg font-bold text-primary">
                  {Math.round((winner.voteCount / totalVotes) * 100)}%
                </Text>
              </View>
              <Progress 
                value={(winner.voteCount / totalVotes) * 100} 
                className="h-3"
              />
            </View>

            <Text className="block text-center text-sm text-muted-foreground mt-2">
              {winner.voteCount} / {totalVotes} 票
            </Text>
          </View>
        </View>
      </View>

      {/* 其他版本 */}
      <View className="px-4 mt-6">
        <Text className="block text-base font-medium text-foreground mb-3">
          其他方案
        </Text>
        
        <View className="space-y-3">
          {versions
            .filter(v => v.id !== winner.id)
            .map((version) => (
              <View key={version.id} className="other-card">
                <View className="flex items-center justify-between">
                  <View>
                    <Text className="block text-sm font-medium text-foreground">
                      {version.versionName}
                    </Text>
                    <Text className="block text-xs text-muted-foreground mt-1">
                      {version.voteCount} 票 · {Math.round((version.voteCount / totalVotes) * 100)}%
                    </Text>
                  </View>
                  <Progress 
                    value={(version.voteCount / totalVotes) * 100} 
                    className="w-20 h-2"
                  />
                </View>
              </View>
            ))}
        </View>
      </View>

      {/* 底部按钮 */}
      <View className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4 pb-8">
        {confirmed ? (
          <View className="text-center">
            <View className="flex items-center justify-center mb-3">
              <Check size={20} color="#10B981" />
              <Text className="block text-success font-medium ml-2">已确认此版本</Text>
            </View>
            <Button 
              className="w-full h-12 text-base font-medium"
              onClick={handleViewRoute}
            >
              查看路线
            </Button>
          </View>
        ) : (
          <Button 
            className="w-full h-12 text-base font-medium"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? '确认中...' : '确认此版本'}
          </Button>
        )}
      </View>
    </View>
  )
}
