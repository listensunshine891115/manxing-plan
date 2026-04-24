import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { MapPin, Utensils, Plus, ChevronRight } from 'lucide-react-taro'
import './index.config'

interface CategoryCount {
  primary_tag: string
  count: number
}

export default function Index() {
  const [, setUserInfo] = useState<any>(null)
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([])

  useEffect(() => {
    // 初始化用户信息
    const info = Taro.getStorageSync('userInfo')
    if (info?.id) {
      setUserInfo(info)
      fetchCategoryCounts()
    } else {
      // 创建临时用户
      createTempUser()
    }
  }, [])

  const createTempUser = async () => {
    const tempId = `user_${Date.now()}`
    const tempUser = { id: tempId, name: '旅行者', avatar: '' }
    Taro.setStorageSync('userInfo', tempUser)
    setUserInfo(tempUser)
    fetchCategoryCounts()
  }

  const fetchCategoryCounts = async () => {
    try {
      const res = await Network.request({
        url: '/api/trip/inspirations/count',
        method: 'GET'
      })
      if (res.data?.success) {
        setCategoryCounts(res.data.data || [])
      }
    } catch (err) {
      console.error('[Index] 获取分类统计失败:', err)
    }
  }

  const getCount = (tag: string) => {
    const found = categoryCounts.find(c => c.primary_tag === tag)
    return found?.count || 0
  }

  const handleCategoryClick = (tag: string) => {
    Taro.navigateTo({
      url: `/pages/category/index?tag=${encodeURIComponent(tag)}`
    })
  }

  return (
    <View className="min-h-screen bg-gray-50">
      {/* 顶部标题 */}
      <View className="bg-white px-4 pt-12 pb-4">
        <Text className="block text-2xl font-bold text-gray-900">
          我的灵感库
        </Text>
        <Text className="block text-sm text-gray-500 mt-1">
          收藏旅行灵感，规划完美路线
        </Text>
      </View>

      {/* 分类卡片 */}
      <View className="p-4 space-y-4">
        {/* 景点 */}
        <Card 
          onClick={() => handleCategoryClick('景点')}
          className="bg-gradient-to-br from-blue-500 to-blue-600 cursor-pointer"
        >
          <CardContent className="p-6">
            <View className="flex items-center justify-between">
              <View className="flex items-center">
                <View className="w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                  <MapPin size={24} color="#FFFFFF" />
                </View>
                <View className="ml-4">
                  <Text className="block text-xl font-semibold text-white">
                    景点
                  </Text>
                  <Text className="block text-sm text-blue-100 mt-1">
                    {getCount('景点')} 个灵感点
                  </Text>
                </View>
              </View>
              <ChevronRight size={24} color="rgba(255,255,255,0.6)" />
            </View>
          </CardContent>
        </Card>

        {/* 美食 */}
        <Card 
          onClick={() => handleCategoryClick('美食')}
          className="bg-gradient-to-br from-orange-500 to-orange-600 cursor-pointer"
        >
          <CardContent className="p-6">
            <View className="flex items-center justify-between">
              <View className="flex items-center">
                <View className="w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                  <Utensils size={24} color="#FFFFFF" />
                </View>
                <View className="ml-4">
                  <Text className="block text-xl font-semibold text-white">
                    美食
                  </Text>
                  <Text className="block text-sm text-orange-100 mt-1">
                    {getCount('美食')} 个灵感点
                  </Text>
                </View>
              </View>
              <ChevronRight size={24} color="rgba(255,255,255,0.6)" />
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 底部提示 */}
      <View className="px-4 py-8 text-center">
        <Text className="block text-xs text-gray-400">
          点击分类卡片查看详情
        </Text>
      </View>

      {/* 收录按钮 */}
      <View className="fixed bottom-4 left-4 right-4">
        <Button 
          onClick={() => Taro.navigateTo({ url: '/pages/category/index?tag=景点' })}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white"
        >
          <Plus size={18} color="#FFFFFF" className="mr-1" />
          <Text className="block">收录灵感</Text>
        </Button>
      </View>
    </View>
  )
}
