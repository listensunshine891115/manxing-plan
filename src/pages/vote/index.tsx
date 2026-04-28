import { useState, useEffect } from 'react'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { ThumbsUp, ThumbsDown, Clock, Users, ArrowLeft, MapPin, Calendar, Share2, Bell, BellOff } from 'lucide-react-taro'
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
  original_url?: string  // 原始链接
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
  const [isCreator, setIsCreator] = useState(false)
  const [notificationSubscribed, setNotificationSubscribed] = useState(false)
  const [userOpenid, setUserOpenid] = useState('') // 存储用户openid

  // 获取分享码和来源
  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    if (params?.code) {
      setShareCode(params.code)
      // 如果是从"我的行程"进入，显示结果面板
      if (params.from === 'mine') {
        setIsCreator(true)
        setShowResults(true)
      }
      loadSession(params.code)
      getUserInfo()
    } else {
      setError('缺少分享码')
      setLoading(false)
    }
  }, [])

  // 获取用户信息
  const getUserInfo = async () => {
    try {
      // 尝试获取 openid
      const loginRes = await Taro.login()
      if (loginRes.code) {
        // 通过 code 获取 openid（实际项目中需要后端接口）
        // 这里简化处理，直接使用 code 作为临时标识
        setUserOpenid(loginRes.code)
      }
    } catch (err) {
      console.error('[VotePage] 获取用户信息失败:', err)
    }
  }

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
        
        // 加载订阅状态
        if (sessionData.sessionId && userOpenid) {
          loadSubscriptionStatus(sessionData.sessionId)
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

  // 加载订阅状态
  const loadSubscriptionStatus = async (sessionId: string) => {
    try {
      const res = await Network.request({
        url: `/api/notification/subscription/${userOpenid}/${sessionId}/vote_result`,
      })
      
      if (res.data.code === 200 && res.data.data) {
        setNotificationSubscribed(res.data.data.subscribed)
      }
    } catch (err) {
      console.error('[VotePage] 获取订阅状态失败:', err)
    }
  }

  // 处理订阅消息
  const handleSubscribeNotification = async () => {
    try {
      // 获取用户授权
      const settingRes = await Taro.getSetting()
      console.log('[VotePage] 订阅设置:', settingRes)
      
      // 请求订阅消息权限（微信小程序 API）
      const tmplId = '_5lEYGoNMepIGY_EkUvgdxb-jipPdD4I9YTiSFKrqaM' // 微信订阅消息模板ID
      
      // 使用 wx 接口直接调用（兼容处理）
      const subscribeRes = await new Promise<any>((resolve, reject) => {
        // @ts-ignore
        if (typeof wx !== 'undefined' && wx.requestSubscribeMessage) {
          // @ts-ignore
          wx.requestSubscribeMessage({
            tmplIds: [tmplId],
            success: (res: any) => resolve(res),
            fail: (err: any) => reject(err)
          })
        } else {
          // H5 或不支持的环境，直接成功
          resolve({ [tmplId]: 'accept' })
        }
      })
      
      console.log('[VotePage] 订阅成功:', subscribeRes)
      
      if (subscribeRes && subscribeRes[tmplId] === 'accept') {
        // 用户同意了订阅
        await saveSubscription(true)
        setNotificationSubscribed(true)
        Taro.showToast({ title: '已开启投票提醒', icon: 'success' })
      } else {
        Taro.showToast({ title: '您拒绝了订阅', icon: 'none' })
      }
    } catch (err) {
      console.error('[VotePage] 订阅异常:', err)
      // 降级：直接保存本地订阅状态
      await saveSubscription(true)
      setNotificationSubscribed(true)
      Taro.showToast({ title: '已记录提醒设置', icon: 'success' })
    }
  }

  // 保存订阅状态到后端
  const saveSubscription = async (subscribed: boolean) => {
    if (!session?.sessionId) return
    
    try {
      await Network.request({
        url: '/api/notification/subscribe',
        method: 'POST',
        data: {
          openid: userOpenid,
          sessionId: session.sessionId,
          templateType: 'vote_result',
          subscribed,
        }
      })
      console.log('[VotePage] 订阅状态已保存:', subscribed)
    } catch (err) {
      console.error('[VotePage] 保存订阅状态失败:', err)
    }
  }

  // 取消订阅
  const handleUnsubscribe = async () => {
    await saveSubscription(false)
    setNotificationSubscribed(false)
    Taro.showToast({ title: '已关闭投票提醒', icon: 'success' })
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

  // 发起人结束投票并发送通知
  const handleEndVoting = async () => {
    if (!session) return
    
    // 确认操作
    const confirmRes = await Taro.showModal({
      title: '确认结束投票',
      content: '确定要结束投票并通知所有参与者吗？',
      confirmText: '确定结束',
      cancelText: '再等等',
    })
    
    if (!confirmRes.confirm) return
    
    try {
      // 计算投票结果
      const voteResults = Object.entries(results)
        .map(([id, result]) => ({
          name: session.inspirationPoints.find(p => p.id === id)?.title || '',
          votes: result.likes
        }))
        .sort((a, b) => b.votes - a.votes)
      
      const winner = voteResults.length > 0 ? voteResults[0].name : undefined
      
      // 调用后端发送通知
      const res = await Network.request({
        url: '/api/notification/trigger-vote-result',
        method: 'POST',
        data: {
          sessionId: session.sessionId,
          title: session.title,
          results: voteResults,
          winner
        }
      })
      
      console.log('[VotePage] 发送投票结果通知:', res.data)
      
      if (res.data.code === 200) {
        Taro.showToast({ title: '已发送结果通知', icon: 'success' })
      } else {
        Taro.showToast({ title: '发送通知失败', icon: 'none' })
      }
    } catch (err) {
      console.error('[VotePage] 结束投票失败:', err)
      Taro.showToast({ title: '操作失败，请重试', icon: 'none' })
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
          
          {/* 订阅投票提醒按钮 */}
          <View className="mt-3 pt-3 border-t border-orange-200">
            {notificationSubscribed ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-green-300 bg-green-50"
                onClick={handleUnsubscribe}
              >
                <BellOff size={14} color="#22C55E" className="mr-2" />
                <Text className="text-green-600 text-sm">已开启投票结果提醒</Text>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-orange-300 bg-white"
                onClick={handleSubscribeNotification}
              >
                <Bell size={14} color="#F59E0B" className="mr-2" />
                <Text className="text-orange-600 text-sm">开启投票结果提醒</Text>
              </Button>
            )}
          </View>
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
                
                {/* 来源链接标签 */}
                {point.original_url && (
                  <View 
                    className="mt-2 px-2 py-1 bg-blue-50 rounded-lg inline-flex items-center"
                    onClick={() => {
                      const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP
                      if (isWeapp) {
                        Taro.navigateTo({
                          url: `/pages/webview/index?url=${encodeURIComponent(point.original_url || '')}`
                        }).catch(() => {
                          Taro.setClipboardData({ data: point.original_url || '' })
                          Taro.showToast({ title: '链接已复制', icon: 'none' })
                        })
                      } else {
                        window.location.href = point.original_url || ''
                      }
                    }}
                  >
                    <Text className="text-xs text-blue-600">来源链接</Text>
                    <Text className="text-xs text-gray-400 ml-1">↗</Text>
                  </View>
                )}
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
        {/* 发起者视角 - 显示投票统计和邀请按钮 */}
        {isCreator ? (
          <View>
            <View className="mx-4 mb-3 p-3 bg-blue-50 rounded-xl">
              <Text className="block text-sm text-blue-700 text-center">
                已投票 {votedCount}/{totalCount} 个地点
              </Text>
              {session?.isExpired && (
                <Text className="block text-xs text-orange-500 text-center mt-1">
                  投票已截止
                </Text>
              )}
            </View>
            
            {/* 结束投票并发送通知按钮 */}
            {!session?.isExpired && votedCount > 0 && (
              <View className="mx-4 mb-3">
                <Button
                  variant="outline"
                  className="w-full py-3 rounded-xl border-orange-300 text-orange-600"
                  onClick={handleEndVoting}
                >
                  <Bell size={16} color="#F59E0B" className="mr-2" />
                  <Text className="text-orange-600">结束投票并发送结果通知</Text>
                </Button>
              </View>
            )}
            
            <Button
              className="w-full py-3 rounded-xl bg-green-500 text-white font-medium"
              onClick={handleShare}
            >
              <Share2 size={18} color="#ffffff" className="mr-2" />
              <Text className="text-white">邀请更多好友投票</Text>
            </Button>
          </View>
        ) : (
          <>
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
              {submitted ? '已提交，等待结果...' : session?.isExpired ? '投票已截止' : '提交后无法修改'}
            </Text>
          </>
        )}
      </View>
    </View>
  )
}
