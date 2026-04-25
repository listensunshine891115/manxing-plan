import { useState, useEffect } from 'react'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { ThumbsUp, ThumbsDown, Clock, Users, ArrowLeft, MapPin, Calendar, Share2 } from 'lucide-react-taro'
import './index.config'

interface InspirationPoint {
  id: string
  title: string
  image?: string
  location?: { name: string }
  type?: string
  primaryTag?: string
  price?: string
  rating?: number
}

interface Session {
  sessionId: string
  tripId: string
  title: string
  creatorName: string
  inspirationPoints: InspirationPoint[]
  startDate?: string
  endDate?: string
  meetupPlace?: string[]
  voteDeadline: string
  isExpired: boolean
}

interface VoteResult {
  inspirationId: string
  inspirationTitle: string
  likes: number
  dislikes: number
  percentage: number
  userVote: number
}

export default function VotePage() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [results, setResults] = useState<Record<string, VoteResult>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [shareCode, setShareCode] = useState('')
  const [showResults, setShowResults] = useState(false)

  // 获取分享码
  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    if (params?.code) {
      setShareCode(params.code)
      loadSession(params.code)
    } else {
      setError('缺少分享码')
      setLoading(false)
    }
  }, [])

  // 加载投票会话
  const loadSession = async (code: string) => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: `/api/vote/sessions/${code}`,
      })
      
      console.log('[VotePage] 获取会话响应:', res.data)
      
      if (res.data.code === 200 && res.data.data) {
        const sessionData = res.data.data
        setSession(sessionData)
        
        // 检查是否已经投过票
        if (sessionData.isExpired) {
          // 已截止，直接显示结果
          setShowResults(true)
          loadResults(sessionData.sessionId)
        } else {
          // 未截止，加载投票结果检查是否已投票
          loadResults(sessionData.sessionId)
        }
      } else {
        setError(res.data.msg || '投票链接已失效')
      }
    } catch (err) {
      console.error('[VotePage] 加载会话失败:', err)
      setError('加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 加载投票结果
  const loadResults = async (sessionId: string) => {
    try {
      const userInfo = Taro.getStorageSync('userInfo')
      const openid = userInfo?.openid
      
      const res = await Network.request({
        url: `/api/vote/results/${sessionId}`,
        data: openid ? { openid } : {},
      })
      
      console.log('[VotePage] 获取结果响应:', res.data)
      
      if (res.data.code === 200 && res.data.data) {
        const resultsMap: Record<string, VoteResult> = {}
        const votesMap: Record<string, number> = {}
        
        res.data.data.forEach((item: VoteResult) => {
          resultsMap[item.inspirationId] = item
          votesMap[item.inspirationId] = item.userVote
        })
        
        setResults(resultsMap)
        setVotes(votesMap)
        
        // 检查是否已经投过票
        const hasUserVoted = res.data.data.some((item: VoteResult) => item.userVote !== 0)
        if (hasUserVoted) {
          setSubmitted(true)
        }
      }
    } catch (err) {
      console.error('[VotePage] 加载结果失败:', err)
    }
  }

  // 投票
  const handleVote = (inspirationId: string, value: number) => {
    if (submitted || session?.isExpired) return
    
    setVotes(prev => ({
      ...prev,
      [inspirationId]: prev[inspirationId] === value ? 0 : value
    }))
  }

  // 提交投票
  const handleSubmit = async () => {
    if (!session) return
    
    const voteList = Object.entries(votes)
      .filter(([_, value]) => value !== 0)
      .map(([inspirationId, value]) => {
        const point = session.inspirationPoints.find(p => p.id === inspirationId)
        return {
          inspirationId,
          inspirationTitle: point?.title || '',
          voteValue: value,
        }
      })
    
    if (voteList.length === 0) {
      Taro.showToast({ title: '请至少投票一个灵感点', icon: 'none' })
      return
    }
    
    try {
      setSubmitting(true)
      
      const userInfo = Taro.getStorageSync('userInfo')
      const openid = userInfo?.openid
      const nickname = userInfo?.nickname || '微信用户'
      
      const res = await Network.request({
        url: '/api/vote/submit',
        method: 'POST',
        data: {
          sessionId: session.sessionId,
          shareCode,
          voterOpenid: openid,
          voterName: nickname,
          votes: voteList,
        },
      })
      
      console.log('[VotePage] 提交投票响应:', res.data)
      
      if (res.data.code === 200) {
        setSubmitted(true)
        setShowResults(true)
        Taro.showToast({ title: '投票成功！', icon: 'success' })
        loadResults(session.sessionId)
      } else {
        Taro.showToast({ title: res.data.msg || '提交失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[VotePage] 提交失败:', err)
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  // 返回上一页
  const handleBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
    } else {
      Taro.switchTab({ url: '/pages/index/index' })
    }
  }

  // 分享给好友
  const handleShare = () => {
    // 显示分享菜单
    Taro.showShareMenu({
      withShareTicket: true
    })
  }

  // 配置分享给好友
  useShareAppMessage(() => {
    return {
      title: session?.title || '快来参与旅行投票',
      path: `/pages/vote/index?code=${shareCode}`,
      imageUrl: ''
    }
  })

  // 配置分享到朋友圈
  useShareTimeline(() => {
    return {
      title: session?.title || '快来参与旅行投票',
      query: `code=${shareCode}`,
      imageUrl: ''
    }
  })

  // 获取分类图标
  const getCategoryIcon = (tag?: string) => {
    switch (tag) {
      case '景点': return '🏛️'
      case '美食': return '🍜'
      case '演出': return '🎭'
      case '活动': return '🎪'
      case '购物': return '🛍️'
      default: return '📍'
    }
  }

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  // 渲染投票按钮
  const renderVoteButton = (inspirationId: string, currentVote: number) => {
    if (session?.isExpired || submitted) {
      const result = results[inspirationId]
      return (
        <View className="flex items-center gap-4 text-sm">
          <View className="flex items-center gap-1 text-green-500">
            <ThumbsUp size={16} color="#22C55E" />
            <Text>{result?.likes || 0}</Text>
          </View>
          <View className="flex items-center gap-1 text-red-500">
            <ThumbsDown size={16} color="#EF4444" />
            <Text>{result?.dislikes || 0}</Text>
          </View>
        </View>
      )
    }

    return (
      <View className="flex gap-3">
        <Button
          size="sm"
          className={`px-3 py-1 rounded-full text-sm ${
            currentVote === 1 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
          onClick={() => handleVote(inspirationId, 1)}
        >
          <ThumbsUp size={14} color={currentVote === 1 ? '#fff' : '#6B7280'} />
          <Text className={`ml-1 ${currentVote === 1 ? 'text-white' : 'text-gray-600'}`}>喜欢</Text>
        </Button>
        <Button
          size="sm"
          className={`px-3 py-1 rounded-full text-sm ${
            currentVote === -1 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
          }`}
          onClick={() => handleVote(inspirationId, -1)}
        >
          <ThumbsDown size={14} color={currentVote === -1 ? '#fff' : '#6B7280'} />
          <Text className={`ml-1 ${currentVote === -1 ? 'text-white' : 'text-gray-600'}`}>不喜欢</Text>
        </Button>
      </View>
    )
  }

  // 渲染进度条
  const renderProgress = (inspirationId: string) => {
    const result = results[inspirationId]
    if (!result || result.likes + result.dislikes === 0) {
      return <View className="w-full h-2 bg-gray-100 rounded-full mt-2" />
    }
    
    return (
      <View className="w-full mt-2">
        <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <View 
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${result.percentage}%` }}
          />
        </View>
        <Text className="block text-xs text-gray-400 mt-1 text-right">
          {result.percentage}% 赞成 ({result.likes + result.dislikes}人投票)
        </Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Text className="text-gray-400">加载中...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <Text className="text-red-500 text-lg mb-4">{error}</Text>
        <Button onClick={handleBack}>
          <Text>返回首页</Text>
        </Button>
      </View>
    )
  }

  const votedCount = Object.values(votes).filter(v => v !== 0).length
  const totalCount = session?.inspirationPoints?.length || 0

  return (
    <View className="min-h-screen bg-gray-50 pb-24">
      {/* 头部 */}
      <View className="bg-white px-4 py-4 sticky top-0 z-10 shadow-sm">
        <View className="flex items-center justify-between">
          <View className="flex items-center gap-2" onClick={handleBack}>
            <ArrowLeft size={20} color="#374151" />
          </View>
          <Text className="text-lg font-semibold text-gray-800">同伴投票</Text>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
          >
            <Share2 size={20} color="#3B82F6" />
          </Button>
        </View>
      </View>

      {/* 标题区域 */}
      <View className="bg-white mx-4 mt-4 p-4 rounded-2xl shadow-sm">
        <Text className="block text-xl font-bold text-gray-800">{session?.title}</Text>
        <View className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <View className="flex items-center gap-1">
            <Users size={14} color="#6B7280" />
            <Text>{session?.creatorName}</Text>
          </View>
          {session?.isExpired && (
            <View className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-full">
              <Clock size={12} color="#EF4444" />
              <Text className="text-xs text-red-500">已截止</Text>
            </View>
          )}
        </View>
      </View>

      {/* 旅行信息 */}
      {(session?.startDate || session?.meetupPlace?.length) && (
        <View className="bg-white mx-4 mt-3 p-4 rounded-2xl shadow-sm">
          {session?.startDate && (
            <View className="flex items-center mb-2">
              <Calendar size={16} color="#3B82F6" className="mr-2" />
              <Text className="text-sm text-gray-700">
                旅行日期：{formatDate(session.startDate)}
                {session.endDate && session.endDate !== session.startDate && ` 至 ${formatDate(session.endDate)}`}
              </Text>
            </View>
          )}
          {session?.meetupPlace && session.meetupPlace.length > 0 && (
            <View className="flex items-center flex-wrap gap-2">
              <MapPin size={16} color="#3B82F6" />
              {session.meetupPlace.map((place, index) => (
                <View key={index} className="px-2 py-1 bg-blue-50 rounded-full">
                  <Text className="text-xs text-blue-600">{place}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 截止时间提示 */}
      {!session?.isExpired && (
        <View className="mx-4 mt-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
          <View className="flex items-center">
            <Clock size={16} color="#F59E0B" className="mr-2" />
            <Text className="text-sm text-orange-600">
              投票截止：{new Date(session?.voteDeadline || '').toLocaleString('zh-CN')}
            </Text>
          </View>
          <Text className="text-xs text-orange-500 mt-1">
            截止时间到达后，未投票者视为弃权
          </Text>
        </View>
      )}

      {/* 状态提示 */}
      {submitted && (
        <View className="mx-4 mt-3 p-3 bg-green-50 rounded-xl border border-green-200">
          <Text className="block text-green-600 text-sm text-center">
            您已完成投票，感谢参与！
          </Text>
        </View>
      )}

      {/* 切换查看结果 */}
      {submitted && !session?.isExpired && (
        <View className="mx-4 mt-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowResults(!showResults)}
          >
            <Text>{showResults ? '返回投票' : '查看投票结果'}</Text>
          </Button>
        </View>
      )}

      {/* 灵感点列表 */}
      <View className="mx-4 mt-4 space-y-3">
        {session?.inspirationPoints.map((point) => (
          <View key={point.id} className="bg-white p-4 rounded-2xl shadow-sm">
            <View className="flex gap-3">
              {/* 图片 */}
              {point.image ? (
                <Image
                  src={point.image}
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  mode="aspectFill"
                />
              ) : (
                <View className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Text className="text-2xl">{getCategoryIcon(point.primaryTag)}</Text>
                </View>
              )}

              {/* 内容 */}
              <View className="flex-1 min-w-0">
                <View className="flex items-start justify-between">
                  <View className="flex-1 min-w-0">
                    <Text className="block text-base font-medium text-gray-800 truncate">
                      {getCategoryIcon(point.primaryTag)} {point.title}
                    </Text>
                    {point.location?.name && (
                      <Text className="block text-sm text-gray-400 mt-1 truncate">
                        📍 {point.location.name}
                      </Text>
                    )}
                    {point.price && (
                      <Text className="block text-sm text-orange-500 mt-1">
                        {point.price}
                      </Text>
                    )}
                  </View>
                </View>

                {/* 投票按钮 */}
                <View className="mt-3">
                  {renderVoteButton(point.id, votes[point.id] || 0)}
                </View>

                {/* 进度条 */}
                {renderProgress(point.id)}
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* 底部操作栏 */}
      <View 
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff', borderTop: '1px solid #e5e5e5',
          padding: '16px', paddingBottom: '32px', zIndex: 100
        }}
      >
        {/* 分享给好友按钮 */}
        <View className="mx-4 mb-3">
          <Button
            className="w-full py-3 rounded-xl bg-green-500 text-white font-medium"
            onClick={handleShare}
          >
            <Share2 size={18} color="#ffffff" className="mr-2" />
            <Text className="text-white">分享给微信好友邀请投票</Text>
          </Button>
        </View>
        
        {/* 提交投票按钮 */}
        {!submitted && !session?.isExpired && (
          <View className="mx-4">
            <Text className="block text-sm text-gray-500 text-center mb-2">
              已投票 {votedCount}/{totalCount} 个灵感点
            </Text>
            <Button
              className={`w-full py-3 rounded-xl text-white font-medium ${
                submitting || votedCount === 0 ? 'bg-gray-300' : 'bg-blue-500'
              }`}
              disabled={submitting || votedCount === 0}
              onClick={handleSubmit}
            >
              <Text className="text-white">{submitting ? '提交中...' : '提交投票'}</Text>
            </Button>
          </View>
        )}
        <Text className="block text-xs text-gray-400 text-center mt-2">
          提交后无法修改
        </Text>
      </View>
    </View>
  )
}
