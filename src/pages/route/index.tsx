import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Share2, ChevronDown, ChevronUp, MapPin, Clock, Navigation } from 'lucide-react-taro'
import { TripDay, TripItem, TripVersion } from '@/types'
import './index.css'

// 模拟数据
const mockVersions: TripVersion[] = [
  {
    id: 'v1',
    versionName: '经典打卡线',
    voteCount: 3,
    isFinal: false,
    createTime: Date.now(),
    content: [
      {
        day: 1,
        date: '2024-01-15',
        items: [
          {
            id: '1',
            inspirationId: '1',
            title: '厦门大学',
            image: 'https://images.unsplash.com/photo-1569152811536-fb47aced8409?w=200',
            location: { name: '厦门大学', lat: 24.434, lng: 118.096 },
            type: 'spot',
            startTime: '09:00',
            duration: 180,
            note: '记得提前预约'
          },
          {
            id: '2',
            inspirationId: '4',
            title: '南普陀寺',
            image: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=200',
            location: { name: '南普陀寺', lat: 24.436, lng: 118.102 },
            type: 'spot',
            startTime: '12:00',
            duration: 120
          },
          {
            id: '3',
            inspirationId: '2',
            title: '曾厝垵小吃街',
            image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=200',
            location: { name: '曾厝垵', lat: 24.437, lng: 118.065 },
            type: 'food',
            startTime: '14:00',
            duration: 90
          }
        ]
      },
      {
        day: 2,
        date: '2024-01-16',
        items: [
          {
            id: '4',
            inspirationId: '1',
            title: '鼓浪屿',
            image: 'https://images.unsplash.com/photo-1569074187119-c87815b476da?w=200',
            location: { name: '鼓浪屿', lat: 24.445, lng: 118.067 },
            type: 'spot',
            startTime: '08:30',
            duration: 360,
            note: '需乘船前往，记得带身份证'
          },
          {
            id: '5',
            inspirationId: '5',
            title: '八市海鲜',
            image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200',
            location: { name: '八市', lat: 24.428, lng: 118.085 },
            type: 'food',
            startTime: '18:00',
            duration: 90
          }
        ]
      },
      {
        day: 3,
        date: '2024-01-17',
        items: [
          {
            id: '6',
            inspirationId: '6',
            title: '环岛路骑行',
            image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200',
            location: { name: '环岛路', lat: 24.451, lng: 118.105 },
            type: 'spot',
            startTime: '09:00',
            duration: 180
          }
        ]
      }
    ]
  },
  {
    id: 'v2',
    versionName: '文艺休闲线',
    voteCount: 5,
    isFinal: false,
    createTime: Date.now(),
    content: [
      {
        day: 1,
        date: '2024-01-15',
        items: [
          {
            id: '7',
            inspirationId: '6',
            title: '环岛路晨骑',
            image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200',
            location: { name: '环岛路', lat: 24.451, lng: 118.105 },
            type: 'spot',
            startTime: '07:00',
            duration: 120
          },
          {
            id: '8',
            inspirationId: '2',
            title: '曾厝垵早茶',
            image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=200',
            location: { name: '曾厝垵', lat: 24.437, lng: 118.065 },
            type: 'food',
            startTime: '10:00',
            duration: 90
          }
        ]
      },
      {
        day: 2,
        date: '2024-01-16',
        items: [
          {
            id: '9',
            inspirationId: '1',
            title: '鼓浪屿慢游',
            image: 'https://images.unsplash.com/photo-1569074187119-c87815b476da?w=200',
            location: { name: '鼓浪屿', lat: 24.445, lng: 118.067 },
            type: 'spot',
            startTime: '10:00',
            duration: 480,
            note: '悠闲游览各老建筑'
          }
        ]
      },
      {
        day: 3,
        date: '2024-01-17',
        items: [
          {
            id: '10',
            inspirationId: '4',
            title: '厦门大学',
            image: 'https://images.unsplash.com/photo-1569152811536-fb47aced8409?w=200',
            location: { name: '厦门大学', lat: 24.434, lng: 118.096 },
            type: 'spot',
            startTime: '09:00',
            duration: 180
          }
        ]
      }
    ]
  },
  {
    id: 'v3',
    versionName: '美食探索线',
    voteCount: 2,
    isFinal: false,
    createTime: Date.now(),
    content: [
      {
        day: 1,
        date: '2024-01-15',
        items: [
          {
            id: '11',
            inspirationId: '5',
            title: '八市早市',
            image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200',
            location: { name: '八市', lat: 24.428, lng: 118.085 },
            type: 'food',
            startTime: '06:00',
            duration: 120
          },
          {
            id: '12',
            inspirationId: '2',
            title: '曾厝垵午餐',
            image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=200',
            location: { name: '曾厝垵', lat: 24.437, lng: 118.065 },
            type: 'food',
            startTime: '12:00',
            duration: 120
          }
        ]
      },
      {
        day: 2,
        date: '2024-01-16',
        items: [
          {
            id: '13',
            inspirationId: '3',
            title: '演唱会之夜',
            image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=200',
            location: { name: '厦门体育中心', lat: 24.481, lng: 118.124 },
            type: 'show',
            startTime: '19:30',
            duration: 180,
            note: '演唱会门票已购'
          }
        ]
      }
    ]
  }
]

const typeConfig = {
  spot: { color: '#3B82F6', label: '景点' },
  food: { color: '#F59E0B', label: '美食' },
  show: { color: '#8B5CF6', label: '演出' },
  hotel: { color: '#10B981', label: '住宿' }
}

export default function Route() {
  const [activeVersion, setActiveVersion] = useState('v1')
  const [expandedDays, setExpandedDays] = useState<number[]>([1, 2, 3])

  const currentVersion = mockVersions.find(v => v.id === activeVersion) || mockVersions[0]

  const toggleDay = (day: number) => {
    setExpandedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    )
  }

  const handleConfirm = () => {
    // TODO: 调用后端API确认行程
    alert('行程已确认！')
  }

  const handleShareVote = () => {
    // TODO: 生成投票链接并分享
    window.location.href = '/pages/vote/index'
  }

  const handleRegenerate = () => {
    // TODO: 重新生成路线
    window.location.href = '/pages/generate/index'
  }

  return (
    <View className="min-h-screen bg-background pb-32">
      {/* 顶部导航 */}
      <View className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <View className="flex items-center justify-between">
          <View className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft size={24} color="#1E293B" />
            </Button>
            <Text className="block text-lg font-semibold text-foreground ml-2">路线方案</Text>
          </View>
          <Button variant="ghost" size="icon">
            <Share2 size={20} color="#3B82F6" />
          </Button>
        </View>
      </View>

      {/* 版本切换 Tab */}
      <View className="px-4 py-3 border-b border-border" style={{ backgroundColor: '#F8FAFC' }}>
        <Tabs value={activeVersion} onValueChange={setActiveVersion}>
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            {mockVersions.map((v, index) => (
              <TabsTrigger 
                key={v.id} 
                value={v.id}
                className="px-4 py-2 text-sm whitespace-nowrap"
              >
                版本{index + 1} · {v.versionName}
                {v.voteCount > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {v.voteCount}票
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </View>

      {/* 路线日程 */}
      <View className="px-4 py-4 space-y-4">
        {currentVersion.content.map((day: TripDay) => (
          <View key={day.day} className="day-section">
            {/* 天数标题 */}
            <View 
              className="day-header"
              onClick={() => toggleDay(day.day)}
            >
              <View className="day-info">
                <View className="day-number">Day {day.day}</View>
                <Text className="block text-sm text-muted-foreground">{day.date}</Text>
              </View>
              <View className="flex items-center">
                <Badge variant="secondary" className="mr-2">
                  {day.items.length}个地点
                </Badge>
                {expandedDays.includes(day.day) ? (
                  <ChevronUp size={20} color="#64748B" />
                ) : (
                  <ChevronDown size={20} color="#64748B" />
                )}
              </View>
            </View>

            {/* 展开的日程项 */}
            {expandedDays.includes(day.day) && (
              <View className="day-items">
                {day.items.map((item: TripItem, index: number) => (
                  <View key={item.id} className="trip-item">
                    {/* 时间线 */}
                    <View className="timeline">
                      <View className="timeline-dot" />
                      {index < day.items.length - 1 && <View className="timeline-line" />}
                    </View>
                    
                    {/* 内容 */}
                    <View className="item-content">
                      <View className="flex items-start gap-3">
                        <Image 
                          src={item.image}
                          className="w-16 h-16 rounded-lg object-cover"
                          mode="aspectFill"
                        />
                        <View className="flex-1 min-w-0">
                          <View className="flex items-center gap-2 mb-1">
                            <Text className="block text-sm font-medium text-foreground truncate">
                              {item.title}
                            </Text>
                            <Badge 
                              className="text-xs px-2 py-1"
                              style={{ backgroundColor: typeConfig[item.type].color }}
                            >
                              {typeConfig[item.type].label}
                            </Badge>
                          </View>
                          <View className="flex items-center text-xs text-muted-foreground mb-1">
                            <MapPin size={12} color="#94A3B8" className="mr-1" />
                            <Text className="block truncate">{item.location.name}</Text>
                          </View>
                          {item.startTime && (
                            <View className="flex items-center text-xs text-muted-foreground">
                              <Clock size={12} color="#94A3B8" className="mr-1" />
                              <Text className="block">{item.startTime}</Text>
                              {item.duration && (
                                <Text className="block ml-1">· {item.duration}分钟</Text>
                              )}
                            </View>
                          )}
                          {item.note && (
                            <Text className="block text-xs text-orange-500 mt-1">
                              {item.note}
                            </Text>
                          )}
                        </View>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <Navigation size={18} color="#3B82F6" />
                        </Button>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* 底部操作栏 */}
      <View className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-4 pb-8">
        <View className="flex gap-3 mb-3">
          <Button 
            variant="outline" 
            className="flex-1 h-12"
            onClick={handleShareVote}
          >
            <Share2 size={18} color="#3B82F6" className="mr-2" />
            分享投票
          </Button>
          <Button 
            className="flex-1 h-12 text-base font-medium"
            onClick={handleConfirm}
          >
            确定行程
          </Button>
        </View>
        <Text 
          className="block text-center text-sm text-primary"
          onClick={handleRegenerate}
        >
          重新生成
        </Text>
      </View>
    </View>
  )
}
