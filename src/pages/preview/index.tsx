import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  MessageCircle, Link2, Check, 
  Sparkles, MapPin, ChevronRight, Send, User
} from 'lucide-react-taro'
import './preview.css'

// 模拟公众号消息
interface WxMessage {
  id: string
  type: 'bind' | 'link' | 'text'
  content: string
  fromUser: string
  time: string
  status: 'pending' | 'success' | 'failed'
  result?: string
}

// 模拟灵感数据
interface Inspiration {
  id: string
  title: string
  type: 'spot' | 'food' | 'show' | 'hotel'
  source: string
  time: string
  selected: boolean
}

const typeConfig = {
  spot: { icon: '🏛️', label: '景点' },
  food: { icon: '🍜', label: '美食' },
  show: { icon: '🎭', label: '演出' },
  hotel: { icon: '🏨', label: '住宿' }
}

export default function Preview() {
  // 登录状态
  const [loggedIn, setLoggedIn] = useState(false)
  const [userCode, setUserCode] = useState('')
  
  // 模拟公众号界面
  const [activeTab, setActiveTab] = useState<'mp' | 'mini'>('mini')
  const [messages, setMessages] = useState<WxMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  
  // 灵感库
  const [inspirations, setInspirations] = useState<Inspiration[]>([
    { id: '1', title: '上海外滩夜景攻略', type: 'spot', source: '小红书', time: '今天', selected: false },
    { id: '2', title: '杭州西湖十景打卡', type: 'spot', source: '小红书', time: '昨天', selected: false },
    { id: '3', title: '杭州必吃美食清单', type: 'food', source: '大众点评', time: '昨天', selected: false },
    { id: '4', title: '周杰伦演唱会上海站', type: 'show', source: '大麦', time: '3天前', selected: false },
  ])

  // 模拟登录
  const handleLogin = () => {
    const code = generateCode()
    setUserCode(code)
    setLoggedIn(true)
    setMessages([{
      id: '1',
      type: 'text',
      content: '欢迎使用旅行灵感库！🎉\n\n请先打开小程序获取用户码，然后发送：\n绑定#用户码',
      fromUser: '旅行助手',
      time: new Date().toLocaleTimeString(),
      status: 'success'
    }])
  }

  // 模拟发送消息
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return

    const newMsg: WxMessage = {
      id: Date.now().toString(),
      type: inputMessage.includes('绑定#') ? 'bind' : inputMessage.includes('http') ? 'link' : 'text',
      content: inputMessage,
      fromUser: '我',
      time: new Date().toLocaleTimeString(),
      status: 'pending'
    }

    setMessages(prev => [...prev, newMsg])
    setInputMessage('')

    // 模拟自动回复
    setTimeout(() => {
      let reply: WxMessage
      
      if (newMsg.type === 'bind') {
        const code = userCode || 'ABC123'
        reply = {
          id: (Date.now() + 1).toString(),
          type: 'text',
          content: `✅ 绑定成功！\n\n账号：旅行者\n用户码：${code}\n\n现在您可以发送旅行链接，我会自动收录到您的灵感库。\n\n请打开小程序查看～`,
          fromUser: '旅行助手',
          time: new Date().toLocaleTimeString(),
          status: 'success'
        }
        // 添加灵感
        setInspirations(prev => [{
          id: Date.now().toString(),
          title: '测试景点',
          type: 'spot',
          source: '小红书',
          time: '刚刚',
          selected: false
        }, ...prev])
      } else if (newMsg.type === 'link') {
        reply = {
          id: (Date.now() + 1).toString(),
          type: 'text',
          content: `🏛️ 已收录！\n\n上海外滩夜景攻略 | 外滩超美打卡点分享\n\n类型：景点\n来源：小红书\n\n请打开小程序查看您的灵感库～`,
          fromUser: '旅行助手',
          time: new Date().toLocaleTimeString(),
          status: 'success'
        }
        // 添加灵感
        setInspirations(prev => [{
          id: Date.now().toString(),
          title: '上海外滩夜景攻略',
          type: 'spot',
          source: '小红书',
          time: '刚刚',
          selected: false
        }, ...prev])
      } else {
        reply = {
          id: (Date.now() + 1).toString(),
          type: 'text',
          content: `欢迎回来！🎉\n\n已绑定账号：旅行者\n\n请发送旅行相关的分享链接，我会自动帮您收录到灵感库。\n\n支持的平台：小红书、大众点评、大麦、携程等。`,
          fromUser: '旅行助手',
          time: new Date().toLocaleTimeString(),
          status: 'success'
        }
      }

      setMessages(prev => prev.map(m => 
        m.id === newMsg.id ? { ...m, status: 'success' as const } : m
      ).concat(reply))
    }, 1000)
  }

  // 生成用户码
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  // 切换灵感选中
  const toggleInspiration = (id: string) => {
    setInspirations(prev => prev.map(i => 
      i.id === id ? { ...i, selected: !i.selected } : i
    ))
  }

  return (
    <View className="preview-container">
      {/* 顶部标签切换 */}
      <View className="tab-header">
        <View 
          className={`tab-item ${activeTab === 'mini' ? 'active' : ''}`}
          onClick={() => setActiveTab('mini')}
        >
          <MapPin size={16} color={activeTab === 'mini' ? '#3b82f6' : '#999'} />
          <Text>小程序</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'mp' ? 'active' : ''}`}
          onClick={() => setActiveTab('mp')}
        >
          <MessageCircle size={16} color={activeTab === 'mp' ? '#3b82f6' : '#999'} />
          <Text>公众号</Text>
        </View>
      </View>

      {/* 小程序界面 */}
      {activeTab === 'mini' && (
        <View className="mini-app">
          {!loggedIn ? (
            // 登录页
            <View className="login-section">
              <View className="text-center mb-8">
                <View className="logo-icon">
                  <MapPin size={32} color="#fff" />
                </View>
                <Text className="block text-2xl font-bold text-gray-900 mt-4">此刻与你漫行</Text>
                <Text className="block text-sm text-gray-500 mt-1">开启你的旅行灵感之旅</Text>
              </View>

              <Card>
                <CardContent className="space-y-4 pt-6">
                  <Text className="block text-center text-gray-600">
                    登录后获取您的专属用户码
                  </Text>
                  <Button className="w-full bg-blue-500" onClick={handleLogin}>
                    <Text className="text-white">微信一键登录</Text>
                  </Button>
                </CardContent>
              </Card>

              <View className="feature-grid mt-6">
                <View className="feature-item">
                  <Sparkles size={20} color="#3b82f6" />
                  <Text className="block text-sm mt-2">收集灵感</Text>
                </View>
                <View className="feature-item">
                  <MapPin size={20} color="#22c55e" />
                  <Text className="block text-sm mt-2">生成路线</Text>
                </View>
              </View>
            </View>
          ) : (
            // 灵感库页
            <View className="inspiration-section">
              {/* 品牌标识 */}
              <View className="brand-header">
                <View className="flex items-center gap-2">
                  <Sparkles size={20} color="#3b82f6" />
                  <Text className="block text-lg font-semibold">此刻与你漫行</Text>
                </View>
                <Badge variant="secondary">
                  <User size={12} color="#666" />
                  <Text className="ml-1">{userCode}</Text>
                </Badge>
              </View>

              {/* 快捷操作 */}
              <View className="quick-actions">
                <View className="quick-action">
                  <MapPin size={20} color="#3b82f6" />
                  <Text>出行设置</Text>
                </View>
                <View className="quick-action">
                  <Sparkles size={20} color="#f59e0b" />
                  <Text>灵感管理</Text>
                </View>
              </View>

              {/* 提示 */}
              <View className="tip-card">
                <MessageCircle size={14} color="#10b981" />
                <Text>发送分享链接给公众号即可自动收录</Text>
              </View>

              {/* 灵感列表 */}
              <View className="inspiration-list">
                {(['spot', 'food', 'show', 'hotel'] as const).map(type => {
                  const items = inspirations.filter(i => i.type === type)
                  if (items.length === 0) return null
                  const config = typeConfig[type]
                  
                  return (
                    <View key={type} className="inspiration-group">
                      <View className="type-header">
                        <Text className="block">{config.icon} {config.label}</Text>
                      </View>
                      {items.map(item => (
                        <View 
                          key={item.id}
                          className={`inspiration-item ${item.selected ? 'selected' : ''}`}
                          onClick={() => toggleInspiration(item.id)}
                        >
                          <View className="item-checkbox">
                            {item.selected && <Check size={12} color="#fff" />}
                          </View>
                          <View className="item-content">
                            <Text className="block text-sm">{item.title}</Text>
                            <Text className="block text-xs text-gray-400 mt-1">
                              {item.source} · {item.time}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )
                })}
              </View>

              {/* 底部按钮 */}
              <View className="bottom-bar">
                <View className="selected-info">
                  <Text>已选 {inspirations.filter(i => i.selected).length} 项</Text>
                </View>
                <Button className="plan-btn">
                  <Text className="text-white">开始规划路线</Text>
                  <ChevronRight size={16} color="#fff" />
                </Button>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 公众号界面 */}
      {activeTab === 'mp' && (
        <View className="mp-app">
          {/* 公众号头部 */}
          <View className="mp-header">
            <View className="mp-avatar">
              <MessageCircle size={24} color="#fff" />
            </View>
            <View className="mp-info">
              <Text className="block font-medium">旅行助手</Text>
              <Text className="block text-xs text-gray-400">公众号</Text>
            </View>
          </View>

          {/* 消息列表 */}
          <View className="message-list">
            {messages.map(msg => (
              <View 
                key={msg.id} 
                className={`message-item ${msg.fromUser === '我' ? 'mine' : 'other'}`}
              >
                <View className={`message-bubble ${msg.status}`}>
                  <Text className="block text-sm whitespace-pre-wrap">{msg.content}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* 输入区域 */}
          <View className="input-area">
            <View className="input-box">
              <Input
                className="flex-1 px-3 py-2"
                placeholder="输入消息..."
                value={inputMessage}
                onInput={(e: any) => setInputMessage(e.target.value)}
                onConfirm={handleSendMessage}
              />
            </View>
            <Button className="send-btn" onClick={handleSendMessage}>
              <Send size={18} color="#fff" />
            </Button>
          </View>

          {/* 快捷输入 */}
          <View className="quick-inputs">
            <View 
              className="quick-btn"
              onClick={() => setInputMessage(`绑定#${userCode || 'ABC123'}`)}
            >
              <Link2 size={12} color="#3b82f6" />
              <Text>绑定#用户码</Text>
            </View>
            <View 
              className="quick-btn"
              onClick={() => setInputMessage('https://www.xiaohongshu.com/explore/xxx')}
            >
              <Link2 size={12} color="#3b82f6" />
              <Text>发送链接</Text>
            </View>
          </View>
        </View>
      )}

      {/* 底部说明 */}
      <View className="preview-footer">
        <Text className="block text-xs text-gray-400 text-center">
          👆 点击上方标签切换「小程序」和「公众号」界面
        </Text>
        <Text className="block text-xs text-gray-400 text-center mt-1">
          💡 在公众号输入框输入「绑定#ABC123」或发送链接测试
        </Text>
      </View>
    </View>
  )
}
