import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { 
  Sparkles, MapPin, Calendar, Check, User, Settings, Link2,
  X, ChevronRight, Trash2, Plus, Heart
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
  
  // 用户状态
  const [userInfo, setUserInfo] = useState<any>(null)

  // 粘贴链接弹窗
  const [showPasteDialog, setShowPasteDialog] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [pasting, setPasting] = useState(false)

  // 预览灵感点弹窗
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewPoints, setPreviewPoints] = useState<InspirationPoint[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  // 分类弹窗
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [currentCategory, setCurrentCategory] = useState<string>('')

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

  useEffect(() => {
    fetchInspirations()
  }, [])

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
        setShowPasteDialog(false)
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
      tag: '购物', 
      count: inspirations.filter(i => i.primary_tag === '购物').length,
      ...primaryTagConfig['购物']
    },
    { 
      tag: '活动', 
      count: inspirations.filter(i => i.primary_tag === '活动').length,
      ...primaryTagConfig['活动']
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
    <View className="min-h-screen bg-gray-50 pb-24">
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
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs"
              style={{ 
                backgroundColor: userInfo.wx_openid ? '#dcfce7' : '#fef3c7',
                color: userInfo.wx_openid ? '#16a34a' : '#d97706'
              }}
            >
              {userInfo.wx_openid ? (
                <>
                  <Check size={12} color="#16a34a" />
                  <Text>已绑定</Text>
                </>
              ) : (
                <>
                  <Link2 size={12} color="#d97706" />
                  <Text onClick={() => Taro.navigateTo({ url: '/pages/bind-guide/index' })}>去绑定</Text>
                </>
              )}
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
          <View className="flex items-center mb-3">
            <Link2 size={16} color="#10b981" />
            <Text className="block text-sm font-medium text-green-700 ml-2">粘贴灵感</Text>
          </View>
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
        </View>

        {/* 我的灵感点 */}
        <View className="flex items-center justify-between">
          <View className="flex items-center">
            <Text className="block text-base font-semibold text-gray-900">我的灵感点</Text>
            <Badge variant="secondary" className="ml-2 text-xs">
              {inspirations.length} 个
            </Badge>
          </View>
          <Text className="text-xs text-gray-400">点击分类查看</Text>
        </View>
      </View>

      {/* 分类卡片 */}
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

      {/* 空状态 */}
      {inspirations.length === 0 && !loading && (
        <View className="flex flex-col items-center justify-center py-16">
          <View className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Sparkles size={32} color="#9ca3af" />
          </View>
          <Text className="block text-base font-medium text-gray-900 mb-2">暂无灵感</Text>
          <Text className="block text-sm text-gray-400 text-center px-8">
            上方粘贴链接即可收录灵感{'\n'}短视频、票务平台、公众号文章
          </Text>
        </View>
      )}

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

      {/* 粘贴灵感弹窗 */}
      <Dialog open={showPasteDialog} onOpenChange={(open) => !open && setShowPasteDialog(false)}>
        <View className="p-6">
          <View className="text-center mb-4">
            <View className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Link2 size={24} color="#10b981" />
            </View>
            <Text className="block text-lg font-medium text-gray-900">粘贴灵感</Text>
            <Text className="block text-sm text-gray-500 mt-1">
              粘贴你的：种草短视频、票务平台、公众号文章&quot;链接&quot;，一键形成灵感库
            </Text>
          </View>
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <View className="mb-3">
              <Input 
                className="w-full bg-white"
                placeholder="粘贴链接..."
                value={linkInput}
                onInput={(e: any) => setLinkInput(e.target.value)}
              />
            </View>
            <View className="flex gap-2">
              <Button 
                className="flex-1 bg-white border border-gray-200"
                onClick={handlePasteFromClipboard}
              >
                <Text className="text-blue-600">粘贴</Text>
              </Button>
              <Button 
                className="flex-1 bg-blue-500"
                onClick={handlePasteLink}
                disabled={pasting}
              >
                <Text className="text-white">{pasting ? '收录中...' : '收录'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </Dialog>

      {/* 预览灵感点弹窗 */}
      {showPreviewDialog && (
        <View 
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => setShowPreviewDialog(false)}
        >
          <View 
            className="bg-white rounded-2xl w-full max-h-[80vh] flex flex-col"
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
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end"
          onClick={() => setShowCategoryDialog(false)}
        >
          <View 
            className="bg-white rounded-t-2xl w-full max-h-[80vh] flex flex-col"
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
                      setShowPasteDialog(true)
                    }}
                  >
                    <Plus size={14} color="#fff" />
                    <Text className="text-white ml-1">收录灵感</Text>
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
    </View>
  )
}
