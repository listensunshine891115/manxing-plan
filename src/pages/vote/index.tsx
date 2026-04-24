import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Check, Users, MapPin, Clock } from 'lucide-react-taro'
import { TripVersion } from '@/types'
import './index.css'

// 模拟投票数据
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

export default function Vote() {
  const [voted, setVoted] = useState<string | null>(null)
  const [voteLoading, setVoteLoading] = useState(false)
  const [versions, setVersions] = useState(mockVersions)

  const totalVotes = versions.reduce((sum, v) => sum + v.voteCount, 0)

  const handleVote = async (versionId: string) => {
    if (voted) return
    
    setVoteLoading(true)
    
    try {
      // TODO: 调用后端API投票
      // await Network.request({
      //   url: '/api/vote',
      //   method: 'POST',
      //   data: { versionId }
      // })
      
      // 模拟投票
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setVersions(prev => prev.map(v => 
        v.id === versionId 
          ? { ...v, voteCount: v.voteCount + 1 }
          : v
      ))
      setVoted(versionId)
    } catch (error) {
      console.error('投票失败:', error)
    } finally {
      setVoteLoading(false)
    }
  }

  const handleConfirm = () => {
    if (!voted) {
      alert('请先投票')
      return
    }
    // 跳转到结果页
    window.location.href = '/pages/vote-result/index'
  }

  return (
    <View className="min-h-screen bg-background pb-24">
      {/* 顶部导航 */}
      <View className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <View className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft size={24} color="#1E293B" />
          </Button>
          <Text className="block text-lg font-semibold text-foreground ml-2">投票选择</Text>
        </View>
      </View>

      {/* 投票说明 */}
      <View className="px-4 py-4">
        <View className="rounded-xl p-4 border" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
          <View className="flex items-center mb-2">
            <Users size={18} color="#3B82F6" />
            <Text className="block text-sm font-medium text-primary ml-2">
              多人投票
            </Text>
          </View>
          <Text className="block text-xs text-muted-foreground">
            每位成员选择心仪的路线版本，票数最高的版本将作为最终行程。
          </Text>
        </View>
      </View>

      {/* 当前投票状态 */}
      <View className="px-4 mb-4">
        <View className="flex items-center justify-between">
          <Text className="block text-sm text-muted-foreground">当前投票</Text>
          <Text className="block text-sm font-medium text-foreground">
            {totalVotes} 票
          </Text>
        </View>
        {voted && (
          <Text className="block text-xs text-success mt-2">
            您已投票，感谢参与！
          </Text>
        )}
      </View>

      {/* 版本卡片列表 */}
      <View className="px-4 space-y-4">
        {versions.map((version, index) => {
          const percentage = totalVotes > 0 
            ? Math.round((version.voteCount / totalVotes) * 100) 
            : 0
          const isVoted = voted === version.id
          
          return (
            <Card 
              key={version.id}
              className={`overflow-hidden vote-card ${isVoted ? 'voted' : ''}`}
              onClick={() => handleVote(version.id)}
            >
              {/* 卡片头部 */}
              <View className="vote-card-header">
                <View className="flex items-center">
                  <View className="version-badge">版本{index + 1}</View>
                  <Text className="block text-base font-semibold text-foreground ml-2">
                    {version.versionName}
                  </Text>
                </View>
                {isVoted && (
                  <Badge className="bg-success">
                    <Check size={12} color="#ffffff" className="mr-1" />
                    已投票
                  </Badge>
                )}
              </View>

              {/* 路线摘要 */}
              <CardContent className="p-4">
                <View className="flex gap-4 mb-4">
                  <View className="flex items-center text-xs text-muted-foreground">
                    <Clock size={14} color="#94A3B8" className="mr-1" />
                    <Text className="block">{version.content.length}天行程</Text>
                  </View>
                  <View className="flex items-center text-xs text-muted-foreground">
                    <MapPin size={14} color="#94A3B8" className="mr-1" />
                    <Text className="block">
                      {version.content.reduce((sum, day) => sum + day.items.length, 0)}个地点
                    </Text>
                  </View>
                </View>

                {/* 投票进度条 */}
                <View className="mb-2">
                  <View className="flex justify-between text-xs mb-1">
                    <Text className="block text-muted-foreground">投票进度</Text>
                    <Text className="block text-foreground font-medium">{percentage}%</Text>
                  </View>
                  <Progress value={percentage} className="h-2" />
                </View>

                {/* 票数 */}
                <View className="flex justify-between items-center">
                  <Text className="block text-sm text-muted-foreground">
                    {version.voteCount} 票
                  </Text>
                  {!voted && (
                    <Button 
                      size="sm" 
                      variant={isVoted ? 'secondary' : 'default'}
                      disabled={!!voted || voteLoading}
                    >
                      投票
                    </Button>
                  )}
                </View>
              </CardContent>
            </Card>
          )
        })}
      </View>

      {/* 底部按钮 */}
      <View className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4 pb-8">
        <Button 
          className="w-full h-12 text-base font-medium"
          onClick={handleConfirm}
        >
          查看投票结果
        </Button>
      </View>
    </View>
  )
}
