import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView, Image as TaroImage } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Sparkles, MapPin, Calendar, Check, User, Settings, Link2,
  X, ChevronRight, Trash2, Plus, Heart, Clock, Footprints,
  Camera
} from 'lucide-react-taro'
import { Network } from '@/network'
import { primaryTagConfig, secondaryTagConfig } from './config'
import './index.css'

// 灵感点类型 - 预览用
interface InspirationPoint {
  id?: string
  name: string
  location: string
  time: string
  primaryTag: string
  secondaryTag?: string
  price: string
  description: string
  tags: string[]
  sourceUrl: string
  selected: boolean
}

// 二级标签配置

export default function Index() {
  const [inspirations, setInspirations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // 用户状态
  const [userInfo, setUserInfo] = useState<any>(null)

  // 粘贴链接
  const [linkInput, setLinkInput] = useState('')
  const [pasting, setPasting] = useState(false)

  // 行程列表
  const [trips, setTrips] = useState<any[]>([])

  // 预览灵感点弹窗
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewPoints, setPreviewPoints] = useState<InspirationPoint[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  // 分类弹窗
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [currentCategory, setCurrentCategory] = useState<string>('')

  // 图片上传状态
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('')

  // 公众号二维码弹窗
  const [showOfficialAccount, setShowOfficialAccount] = useState(false)
  const [qrCodeLoaded, setQrCodeLoaded] = useState(false)

  // 检查登录状态
  const checkLogin = async () => {
    try {
      const res = await Taro.getStorage({ key: 'userInfo' })
      if (res.data) {
        setUserInfo(res.data)
        return res.data
      }
    } catch {
      // 未登录
    }
    return null
  }

  // 加载灵感列表
  const fetchInspirations = async () => {
    const user = await checkLogin()
    const userId = user?.id || 'guest_' + Date.now()

    try {
      const res = await Network.request({
        url: '/api/trip/inspirations',
        data: { userId }
      })
      if (res.data?.data) {
        setInspirations(res.data.data)
      }
    } catch (error) {
      console.error('获取灵感失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载行程列表
  const fetchTrips = async () => {
    const user = await checkLogin()
    const userId = user?.id || Taro.getStorageSync('userInfo')?.id

    try {
      const res = await Network.request({
        url: '/api/trip/trips',
        data: { userId }
      })
      console.log('[GET] /api/trip/trips - Response:', res.data)
      if (res.data?.data) {
        setTrips(res.data.data)
        console.log('[首页] 获取到行程:', res.data.data.length, '个')
      }
    } catch (error) {
      console.error('获取行程失败:', error)
    }
  }

  useEffect(() => {
    fetchInspirations()
    fetchTrips()
  }, [])

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchInspirations(), fetchTrips()])
    setRefreshing(false)
    Taro.showToast({ title: '刷新成功', icon: 'success' })
  }

  // 微信登录
  const handleLogin = async () => {
    try {
      const user = {
        id: 'user_' + Date.now(),
        openid: 'wx_test_' + Date.now(),
        nickname: '旅行者',
        user_code: generateUserCode(),
        wx_openid: ''
      }
      await Taro.setStorage({ key: 'userInfo', data: user })
      setUserInfo(user)
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/bind-guide/index' })
      }, 500)
    } catch {
      Taro.showToast({ title: '登录失败', icon: 'none' })
    }
  }

  const generateUserCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  // 粘贴链接收录
  const handlePasteLink = async () => {
    if (!linkInput.trim()) {
      Taro.showToast({ title: '请输入链接或文字', icon: 'none' })
      return
    }

    const isUrl = linkInput.includes('http://') || linkInput.includes('https://')

    setPasting(true)
    try {
      Taro.showLoading({ title: '正在提取灵感...' })
      
      const previewRes = await Network.request({
        url: '/api/trip/preview',
        method: 'POST',
        data: {
          userId: userInfo?.id,
          url: isUrl ? linkInput.trim() : undefined,
          text: !isUrl ? linkInput.trim() : undefined
        },
        timeout: 120000
      })
      
      Taro.hideLoading()
      
      if (previewRes.data?.success && previewRes.data?.data?.inspirationPoints?.length > 0) {
        const pointsWithSelected = previewRes.data.data.inspirationPoints.map((p: any) => ({
          ...p,
          selected: p.selected !== false
        }))
        setPreviewPoints(pointsWithSelected)
        setShowPreviewDialog(true)
        setLinkInput('')
      } else {
        Taro.showToast({ title: previewRes.data?.message || '未能提取到灵感点', icon: 'none' })
      }
    } catch (error: any) {
      Taro.hideLoading()
      console.error('[Paste] 预览失败:', error)
      Taro.showToast({ title: '预览失败: ' + (error.message || ''), icon: 'none' })
    } finally {
      setPasting(false)
    }
  }

  // 保存选中的灵感点
  const handleSaveSelected = async () => {
    const selectedPoints = previewPoints.filter(p => p.selected)
    
    if (selectedPoints.length === 0) {
      Taro.showToast({ title: '请至少选择一个灵感点', icon: 'none' })
      return
    }

    setPreviewLoading(true)
    try {
      const items = selectedPoints.map(point => {
        // 根据二级标签自动归类到一级分类
        const primaryTag = point.secondaryTag 
          ? (secondaryTagConfig[point.secondaryTag] || point.primaryTag || '景点')
          : (point.primaryTag || '景点')
        
        return {
          user_id: userInfo?.id,
          title: point.name,
          source: 'xiaohongshu',
          primary_tag: primaryTag,
          secondary_tag: point.secondaryTag || '',
          location_name: point.location,
          time: point.time,
          price: point.price,
          description: point.description,
          original_url: point.sourceUrl,
          tags: point.tags
        }
      })

      const res = await Network.request({
        url: '/api/trip/inspirations/batch',
        method: 'POST',
        data: { items }
      })

      if (res.data?.code === 200 || res.data?.success) {
        Taro.showToast({ title: `已收录 ${selectedPoints.length} 个灵感点`, icon: 'success' })
        setShowPreviewDialog(false)
        setPreviewPoints([])
        fetchInspirations()
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (error) {
      console.error('保存失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setPreviewLoading(false)
    }
  }

  // 切换预览选中
  const togglePointSelected = (index: number) => {
    setPreviewPoints(prev => prev.map((point, i) => 
      i === index ? { ...point, selected: !point.selected } : point
    ))
  }

  const toggleAllPreview = () => {
    const allSelected = previewPoints.every(p => p.selected)
    setPreviewPoints(prev => prev.map(point => ({ ...point, selected: !allSelected })))
  }

  // 粘贴剪贴板
  const handlePasteFromClipboard = async () => {
    try {
      const res = await Taro.getClipboardData()
      if (res.data) {
        setLinkInput(res.data)
        Taro.showToast({ title: '已粘贴', icon: 'success' })
      } else {
        Taro.showToast({ title: '剪贴板为空', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '粘贴失败', icon: 'none' })
    }
  }

  // 图片上传并提取灵感点
  const handleImageUpload = async () => {
    try {
      // 选择图片
      const chooseRes = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })

      if (!chooseRes.tempFilePaths || chooseRes.tempFilePaths.length === 0) {
        return
      }

      const tempFilePath = chooseRes.tempFilePaths[0]
      setUploadingImage(true)
      
      Taro.showLoading({ title: '正在识别图片...' })

      // 上传图片并提取灵感点
      const user = await checkLogin()
      const userId = user?.id || 'guest_' + Date.now()

      // 先上传图片获取本地路径
      const uploadRes = await Network.uploadFile({
        url: '/api/trip/upload-image',
        filePath: tempFilePath,
        name: 'image'
      })

      console.log('[ImageUpload] 上传响应:', uploadRes)

      // 解析响应获取图片路径
      let imagePath = ''
      if (uploadRes.data) {
        const resData = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
        // 优先使用本地路径（解决服务器无法访问外部URL的问题）
        if (resData.data?.localPath) {
          imagePath = resData.data.localPath
          console.log('[ImageUpload] 使用本地路径:', imagePath)
        } else if (resData.data?.url) {
          imagePath = resData.data.url
          console.log('[ImageUpload] 使用URL:', imagePath)
        }
      }

      // 调用图片识别接口提取灵感点
      const parseRes = await Network.request({
        url: '/api/trip/parse-image',
        method: 'POST',
        data: {
          userId,
          imageUrl: imagePath  // 使用本地路径
        },
        timeout: 120000
      })

      Taro.hideLoading()
      setUploadingImage(false)

      console.log('[ImageUpload] 识别响应:', parseRes.data)

      if (parseRes.data?.success && parseRes.data?.data?.inspirationPoints?.length > 0) {
        const pointsWithSelected = parseRes.data.data.inspirationPoints.map((p: any) => ({
          ...p,
          selected: p.selected !== false
        }))
        setPreviewPoints(pointsWithSelected)
        setShowPreviewDialog(true)
        setUploadedImageUrl('')
      } else {
        Taro.showToast({ 
          title: parseRes.data?.message || '未能从图片中提取到灵感点', 
          icon: 'none',
          duration: 3000
        })
        setUploadedImageUrl('')
      }
    } catch (error: any) {
      Taro.hideLoading()
      setUploadingImage(false)
      console.error('[ImageUpload] 处理失败:', error)
      Taro.showToast({ 
        title: '图片处理失败: ' + (error.message || ''), 
        icon: 'none',
        duration: 3000
      })
    }
  }

  // 删除已上传的图片
  const handleRemoveImage = () => {
    setUploadedImageUrl('')
  }

  // 删除灵感点
  const handleDelete = async (id: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这个灵感点吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/trip/inspirations/${id}`,
              method: 'DELETE'
            })
            Taro.showToast({ title: '已删除', icon: 'success' })
            fetchInspirations()
          } catch {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  // 按分类统计
  const categoryStats = [
    { 
      tag: '景点', 
      count: inspirations.filter(i => i.primary_tag === '景点').length,
      ...primaryTagConfig['景点']
    },
    { 
      tag: '美食', 
      count: inspirations.filter(i => i.primary_tag === '美食').length,
      ...primaryTagConfig['美食']
    },
    { 
      tag: '演出', 
      count: inspirations.filter(i => i.primary_tag === '演出').length,
      ...primaryTagConfig['演出']
    },
    { 
      tag: '活动', 
      count: inspirations.filter(i => i.primary_tag === '活动').length,
      ...primaryTagConfig['活动']
    },
    { 
      tag: '购物', 
      count: inspirations.filter(i => i.primary_tag === '购物').length,
      ...primaryTagConfig['购物']
    },
  ]

  // 获取某分类的灵感点
  const getInspirationsByTag = (tag: string) => {
    return inspirations.filter(i => i.primary_tag === tag)
  }

  // 打开分类弹窗
  const openCategory = (tag: string) => {
    setCurrentCategory(tag)
    setShowCategoryDialog(true)
  }

  // 未登录状态
  if (!userInfo) {
    return (
      <View className="min-h-screen bg-background flex flex-col items-center justify-center px-8">
        {/* Logo 和名称 */}
        <View className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-6 shadow-lg">
          <Sparkles size={48} color="#FFFFFF" />
        </View>
        <Text className="block text-2xl font-bold text-foreground mb-1">此刻与你漫行</Text>
        <Text className="block text-sm text-muted-foreground mb-8 text-center">
          记录美好旅程 · 规划完美路线{'\n'}绑定公众号发送链接自动收录灵感
        </Text>
        <Button className="bg-blue-500 w-full max-w-xs" onClick={handleLogin}>
          <User size={18} color="#fff" />
          <Text className="text-white ml-2">微信一键登录</Text>
        </Button>
      </View>
    )
  }

  // 已登录状态
  return (
    <ScrollView
      className="min-h-screen bg-gray-50 pb-24"
      scrollY
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={onRefresh}
    >
      {/* 顶部状态栏 */}
      <View className="bg-white border-b border-gray-100 px-4 py-3">
        <View className="flex items-center justify-between">
          <View className="flex items-center gap-2">
            <Sparkles size={18} color="#3b82f6" />
            <Text className="text-sm font-medium text-gray-900">{userInfo.nickname}</Text>
            <Badge variant="outline" className="text-xs font-mono">
              {userInfo.user_code}
            </Badge>
          </View>
          
          <View className="flex items-center gap-2">
            <View 
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200"
              onClick={() => setShowOfficialAccount(true)}
            >
              <Text style={{ color: '#ea580c', fontSize: '12px' }}>公众号</Text>
            </View>
            <View onClick={() => Taro.navigateTo({ url: '/pages/settings/index' })}>
              <Settings size={20} color="#6b7280" />
            </View>
          </View>
        </View>
      </View>

      {/* 标题区域 */}
      <View className="bg-white px-4 pt-6 pb-4">
        {/* Logo 和名称 */}
        <View className="flex items-center mb-4">
          <View className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
            <Sparkles size={28} color="#FFFFFF" />
          </View>
          <View className="ml-3">
            <Text className="block text-xl font-bold text-gray-900">此刻与你漫行</Text>
            <Text className="block text-xs text-gray-400 mt-1">记录美好旅程</Text>
          </View>
        </View>

        {/* 粘贴灵感输入区 */}
        <View className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-4 border border-green-100">
          <View className="flex items-center mb-2">
            <Link2 size={16} color="#10b981" />
            <Text className="block text-sm font-medium text-green-700 ml-2">粘贴灵感</Text>
          </View>
          <Text className="block text-xs text-green-600 mb-3">
            直接粘贴种草短视频、票务平台、公众号文章&quot;分享链接&quot;，或输入文字灵感
          </Text>
          <View className="flex gap-2">
            <View className="flex-1 bg-white rounded-lg px-3 py-2">
              <Input 
                className="w-full text-sm"
                placeholder="粘贴链接或输入文字..."
                value={linkInput}
                onInput={(e: any) => setLinkInput(e.target.value)}
              />
            </View>
            <Button 
              className="bg-green-500 px-4"
              onClick={handlePasteLink}
              disabled={pasting}
            >
              <Text className="text-white text-sm">{pasting ? '收录中...' : '收录'}</Text>
            </Button>
          </View>
          <Text 
            className="block text-xs text-green-600 mt-2 text-center"
            onClick={handlePasteFromClipboard}
          >
            一键粘贴剪贴板内容
          </Text>
          
          {/* 图片上传区域 */}
          <View className="mt-3 pt-3 border-t border-green-200">
            <Text className="block text-xs text-green-600 mb-2 text-center">
              或上传图片识别灵感点
            </Text>
            <View className="flex items-center justify-center gap-3">
              {uploadedImageUrl ? (
                // 已上传图片预览
                <View style={{ position: 'relative' }}>
                  <TaroImage 
                    src={uploadedImageUrl}
                    style={{ width: '80px', height: '80px', borderRadius: '8px' }}
                    mode="aspectFill"
                  />
                  {uploadingImage && (
                    <View 
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Text className="text-white text-xs">识别中...</Text>
                    </View>
                  )}
                  {!uploadingImage && (
                    <View 
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        width: '20px',
                        height: '20px',
                        backgroundColor: '#ef4444',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onClick={handleRemoveImage}
                    >
                      <X size={12} color="#ffffff" />
                    </View>
                  )}
                </View>
              ) : (
                // 上传按钮
                <View 
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-green-300 flex flex-col items-center justify-center bg-green-50"
                  onClick={handleImageUpload}
                >
                  <Camera size={24} color="#10b981" />
                  <Text className="block text-xs text-green-600 mt-1">上传图片</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* 我的灵感点 */}
        <View className="flex items-center justify-between">
          <View className="flex items-center">
            <Sparkles size={16} color="#8b5cf6" />
            <Text className="block text-base font-semibold text-gray-900 ml-2">我的灵感点</Text>
            <Badge variant="secondary" className="ml-2 text-xs">
              {inspirations.length} 个
            </Badge>
          </View>
          <Text className="text-xs text-gray-400">点击分类查看</Text>
        </View>
      </View>

      {/* 骨架屏加载状态 */}
      {loading && (
        <View className="px-4 py-4 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <View className="flex items-center">
                  <Skeleton className="w-12 h-12 rounded-xl mr-4" />
                  <View className="flex-1">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-16" />
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      )}

      {/* 分类卡片 */}
      {!loading && (
      <View className="px-4 py-4 space-y-3">
        {categoryStats.map(stat => (
          <Card 
            key={stat.tag}
            onClick={() => openCategory(stat.tag)}
            className="bg-white cursor-pointer"
          >
            <CardContent className="p-4">
              <View className="flex items-center justify-between">
                <View className="flex items-center">
                  <View 
                    className="w-12 h-12 rounded-xl flex items-center justify-center mr-4"
                    style={{ backgroundColor: stat.bgColor }}
                  >
                    <Text className="block text-2xl">{stat.icon}</Text>
                  </View>
                  <View>
                    <Text className="block text-base font-medium text-gray-900">
                      {stat.label}
                    </Text>
                    <Text className="block text-sm text-gray-500 mt-1">
                      {stat.count} 个灵感点
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </View>
            </CardContent>
          </Card>
        ))}
      </View>
      )}

      {/* 我的漫行计划 */}
      <View className="px-4 py-4 mb-20">
        <View className="flex items-center justify-between mb-3">
          <View className="flex items-center">
            <Footprints size={16} color="#3b82f6" />
            <Text className="block text-base font-semibold text-gray-900 ml-2">我的漫行计划</Text>
            <Badge variant="secondary" className="ml-2 text-xs">
              {trips.length} 个
            </Badge>
          </View>
        </View>
        {trips.length > 0 ? (
          <View className="space-y-3">
            {trips.slice(0, 3).map((trip) => (
              <View 
                key={trip.id}
                className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100"
                onClick={() => {
                  Taro.setStorage({ key: 'currentTrip', data: trip })
                  // 如果有投票会话，跳转到投票结果页面
                  if (trip.voteSession?.share_code) {
                    Taro.navigateTo({ url: `/pages/vote/index?code=${trip.voteSession.share_code}&from=mine` })
                  } else {
                    // 否则跳转到行程概览页面
                    Taro.navigateTo({ url: '/pages/preview/index' })
                  }
                }}
              >
                <View className="flex items-center justify-between">
                  <View className="flex items-center">
                    <Calendar size={14} color="#3b82f6" />
                    <Text className="block text-sm font-medium text-gray-900 ml-2">
                      {trip.version_name || '我的行程'}
                    </Text>
                    {trip.voteSession && (
                      <View className="ml-2 px-2 rounded text-xs bg-orange-100 text-orange-600 border border-orange-200" style={{ paddingTop: 2, paddingBottom: 2 }}>
                        投票中
                      </View>
                    )}
                  </View>
                  <View className="flex items-center text-xs text-gray-500">
                    <Clock size={12} color="#9ca3af" />
                    <Text className="ml-1">
                      {trip.settings?.days || 1}天行程
                    </Text>
                  </View>
                </View>
                {trip.settings?.startDate && (
                  <Text className="block text-xs text-gray-500 mt-1 ml-5">
                    {trip.settings.startDate}
                  </Text>
                )}
                {trip.voteSession?.share_code && (
                  <Text className="block text-xs text-orange-600 mt-1 ml-5">
                    点击查看投票结果
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View className="bg-gray-50 rounded-xl p-6 text-center">
            <Text className="block text-sm text-gray-400">
              暂无行程计划{'\n'}选择灵感点即可生成行程
            </Text>
          </View>
        )}
      </View>

      {/* 底部操作栏 */}
      {inspirations.length > 0 && (
        <View className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 pb-8">
          <View className="flex gap-3">
            {/* 查看收藏 */}
            <Button 
              className="flex-1 bg-white border border-gray-200"
              onClick={() => Taro.navigateTo({ url: '/pages/favorites/index' })}
            >
              <Heart size={16} color="#ef4444" />
              <Text className="text-gray-700 ml-1">收藏</Text>
            </Button>
            
            {/* 选择灵感 */}
            <Button 
              className="flex-1 bg-blue-500"
              onClick={() => Taro.navigateTo({ url: '/pages/select/index' })}
            >
              <Check size={16} color="#fff" />
              <Text className="text-white ml-1">选择灵感</Text>
            </Button>
          </View>
        </View>
      )}

      {/* 预览灵感点弹窗 */}
      {showPreviewDialog && (
        <View 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowPreviewDialog(false)}
        >
          <View 
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <View className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <Text className="block text-lg font-medium text-gray-900">预览灵感点</Text>
              <View className="flex items-center gap-3">
                <Text 
                  className="text-sm text-blue-500"
                  onClick={toggleAllPreview}
                >
                  {previewPoints.every(p => p.selected) ? '取消全选' : '全选'}
                </Text>
                <View onClick={() => setShowPreviewDialog(false)}>
                  <X size={24} color="#9ca3af" />
                </View>
              </View>
            </View>

            {/* 统计信息 */}
            <View className="px-4 py-2 bg-gray-50 flex items-center justify-between">
              <Text className="text-sm text-gray-500">
                共 {previewPoints.length} 个灵感点，已选择 {previewPoints.filter(p => p.selected).length} 个
              </Text>
            </View>

            {/* 灵感点列表 */}
            <View className="flex-1 overflow-y-auto p-4 space-y-3">
              {previewPoints.map((point, index) => (
                <Card 
                  key={index}
                  className={`overflow-hidden ${point.selected ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => togglePointSelected(index)}
                >
                  <View className={`p-4 ${point.selected ? 'bg-blue-50' : 'bg-white'}`}>
                    <View className="flex items-start gap-3">
                      <View 
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-1 ${
                          point.selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}
                      >
                        {point.selected && <Check size={12} color="#fff" />}
                      </View>

                      <View className="flex-1">
                        <Text className="block text-base font-medium text-gray-900 mb-2">
                          {point.name}
                        </Text>
                        
                        <View className="flex items-center gap-2 flex-wrap mb-2">
                          {/* 根据二级标签自动计算一级分类 */}
                          {(() => {
                            const displayPrimaryTag = point.secondaryTag 
                              ? (secondaryTagConfig[point.secondaryTag] || point.primaryTag || '景点')
                              : (point.primaryTag || '景点')
                            const tagConfig = primaryTagConfig[displayPrimaryTag] || primaryTagConfig['景点']
                            return (
                              <Badge 
                                style={{ 
                                  backgroundColor: tagConfig.bgColor,
                                  color: tagConfig.color
                                }}
                              >
                                {tagConfig.icon} {tagConfig.label}
                              </Badge>
                            )
                          })()}
                          {point.secondaryTag && (
                            <Badge variant="secondary">
                              {point.secondaryTag}
                            </Badge>
                          )}
                        </View>
                        
                        {point.location && (
                          <View className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                            <MapPin size={12} color="#6b7280" />
                            <Text className="block">{point.location}</Text>
                          </View>
                        )}
                        {point.time && (
                          <View className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                            <Calendar size={12} color="#6b7280" />
                            <Text className="block">{point.time}</Text>
                          </View>
                        )}
                        {point.price && point.price !== '待定' && (
                          <Text className="block text-sm text-orange-500 mb-2">
                            💰 {point.price}
                          </Text>
                        )}
                        <Text className="block text-sm text-gray-600">
                          {point.description}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>
              ))}
            </View>

            {/* 保存按钮 */}
            <View className="p-4 border-t border-gray-100">
              <Button 
                className="w-full bg-blue-500"
                onClick={handleSaveSelected}
                disabled={previewLoading}
              >
                <Text className="text-white">
                  {previewLoading ? '保存中...' : `收录 ${previewPoints.filter(p => p.selected).length} 个灵感点`}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 分类弹窗 */}
      {showCategoryDialog && (
        <View 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-end'
          }}
          onClick={() => setShowCategoryDialog(false)}
        >
          <View 
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <View className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <View className="flex items-center">
                <Text className="block text-lg font-medium text-gray-900">
                  {primaryTagConfig[currentCategory]?.icon} {currentCategory}
                </Text>
                <Badge 
                  className="ml-2" 
                  style={{ 
                    backgroundColor: primaryTagConfig[currentCategory]?.bgColor,
                    color: primaryTagConfig[currentCategory]?.color
                  }}
                >
                  {getInspirationsByTag(currentCategory).length} 个
                </Badge>
              </View>
              <View onClick={() => setShowCategoryDialog(false)}>
                <X size={24} color="#9ca3af" />
              </View>
            </View>

            {/* 灵感点列表 */}
            <View className="flex-1 overflow-y-auto p-4">
              {getInspirationsByTag(currentCategory).length === 0 ? (
                <View className="flex flex-col items-center justify-center py-12">
                  <Text className="block text-gray-500 mb-2">暂无{currentCategory}灵感点</Text>
                  <Button 
                    size="sm" 
                    className="bg-green-500"
                    onClick={() => {
                      setShowCategoryDialog(false)
                      // 滚动到顶部粘贴灵感
                      Taro.pageScrollTo({ scrollTop: 0, duration: 300 })
                    }}
                  >
                    <Plus size={14} color="#fff" />
                    <Text className="text-white ml-1">去收录</Text>
                  </Button>
                </View>
              ) : (
                <View className="space-y-3">
                  {getInspirationsByTag(currentCategory).map(item => (
                    <Card key={item.id} className="bg-gray-50">
                      <CardContent className="p-4">
                        <View className="flex items-center justify-between">
                          <View className="flex-1">
                            <Text className="block text-sm font-medium text-gray-900 mb-1">
                              {item.title}
                            </Text>
                            {item.secondary_tag && (
                              <Badge variant="secondary" className="text-xs">
                                {item.secondary_tag}
                              </Badge>
                            )}
                            {item.location_name && (
                              <View className="flex items-center gap-1 mt-2">
                                <MapPin size={10} color="#6b7280" />
                                <Text className="block text-xs text-gray-500">{item.location_name}</Text>
                              </View>
                            )}
                          </View>
                          <View 
                            onClick={() => handleDelete(item.id)}
                            className="p-2"
                          >
                            <Trash2 size={16} color="#9ca3af" />
                          </View>
                        </View>
                      </CardContent>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* 微信公众号弹窗 */}
      {showOfficialAccount && (
        <View 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowOfficialAccount(false)}
        >
          <View 
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '320px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Text className="block text-lg font-bold text-gray-900 mb-2">
              此刻与你漫行
            </Text>
            <Text className="block text-sm text-gray-500 mb-4">
              长按识别二维码关注公众号
            </Text>
            
            {/* 二维码图片 */}
            <View 
              style={{
                width: '200px',
                height: '200px',
                backgroundColor: '#f3f4f6',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                overflow: 'hidden'
              }}
            >
              {!qrCodeLoaded && (
                <View className="flex flex-col items-center">
                  <Text className="block text-3xl mb-2">📱</Text>
                  <Text className="block text-xs text-gray-400">公众号二维码</Text>
                </View>
              )}
              <TaroImage 
                src="https://manxing-plan-1309460899.cos.ap-guangzhou.myqcloud.com/wechat/official-account-qrcode.jpg"
                style={{ width: '200px', height: '200px', display: qrCodeLoaded ? 'block' : 'none' }}
                mode="aspectFit"
                onLoad={() => setQrCodeLoaded(true)}
                onError={() => setQrCodeLoaded(false)}
              />
            </View>
            
            <Text className="block text-sm text-gray-600 mb-2">
              微信号：wanderingsparkling
            </Text>
            
            <Text className="block text-xs text-gray-400 mb-4">
              公众号ID：gh_8d07103cbd76
            </Text>
            
            <Button 
              variant="outline"
              className="w-full"
              onClick={() => setShowOfficialAccount(false)}
            >
              <Text className="text-gray-600">关闭</Text>
            </Button>
          </View>
        </View>
      )}
    </ScrollView>
  )
}
