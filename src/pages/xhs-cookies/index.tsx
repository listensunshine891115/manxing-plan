import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Network } from '@/network'
import { ArrowLeft, Copy, Check, CircleAlert } from 'lucide-react-taro'

export default function XhsCookies() {
  const [cookies, setCookies] = useState('')
  const [userAgent, setUserAgent] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // 获取用户代理
  const getUserAgent = () => {
    Taro.getSystemInfo({
      success: (res) => {
        const ua = res.platform === 'devtools' 
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
          : res.system && res.system.includes('iOS')
            ? `Mozilla/5.0 (iPhone; CPU iPhone OS ${res.system.replace('iOS ', '')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${res.system.replace('iOS ', '')} Mobile/15E148 Safari/604.1`
            : 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        setUserAgent(ua)
      }
    })
  }

  const handleSave = async () => {
    if (!cookies.trim()) {
      setError('请先粘贴 cookies')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // 验证 cookies 是否是有效的 JSON 数组
      let cookiesArray = cookies.trim()
      try {
        const parsed = JSON.parse(cookiesArray)
        if (!Array.isArray(parsed)) {
          throw new Error('不是数组')
        }
        cookiesArray = JSON.stringify(parsed)
      } catch {
        // 如果不是 JSON，尝试作为字符串处理
        if (!cookies.includes('=')) {
          throw new Error('无效的 cookies 格式')
        }
      }

      const res = await Network.request({
        url: '/api/trip/xhs-cookies',
        method: 'POST',
        data: {
          cookies: cookiesArray,
          user_agent: userAgent || 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        }
      })

      if (res.data?.success) {
        setSuccess(true)
        Taro.showToast({ title: '设置成功', icon: 'success' })
      } else {
        setError(res.data?.msg || '设置失败')
      }
    } catch (e: any) {
      setError(e.message || '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  const copyInstructions = () => {
    const instructions = `小红书 cookies 获取步骤：
1. 在手机微信中打开小红书并登录
2. 打开小红书任意笔记，长按复制链接
3. 在电脑浏览器中粘贴并打开
4. 按 F12 打开开发者工具
5. 切换到 Network 标签
6. 刷新页面
7. 找到任意请求，查看 Request Headers 中的 Cookie
8. 复制整个 Cookie 值`

    Taro.setClipboardData({
      data: instructions,
      success: () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    })
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      {/* 顶部导航 */}
      <View className="bg-white px-4 py-3 flex items-center sticky top-0 z-10 border-b border-gray-100">
        <View onClick={() => Taro.navigateBack()} className="p-2 -ml-2">
          <ArrowLeft size={20} color="#333" />
        </View>
        <Text className="block text-base font-semibold text-gray-900 ml-2">小红书登录设置</Text>
      </View>

      <ScrollView className="p-4" scrollY>
        {/* 说明 */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <View className="flex items-start">
              <CircleAlert size={20} color="#f59e0b" className="mr-3 mt-1 flex-shrink-0" />
              <View>
                <Text className="block text-sm font-medium text-gray-900 mb-2">为什么要设置 cookies？</Text>
                <Text className="block text-sm text-gray-600 leading-relaxed">
                  小红书视频需要登录才能访问。通过设置登录后的 cookies，可以让我帮你提取视频中的字幕和灵感点。
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 获取步骤 */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <View className="flex items-center justify-between mb-3">
              <Text className="block text-sm font-medium text-gray-900">获取 cookies 步骤</Text>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={copyInstructions}
              >
                {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} color="#666" />}
                <Text className="ml-1 text-xs text-gray-500">{copied ? '已复制' : '复制'}</Text>
              </Button>
            </View>
            
            <View className="text-sm text-gray-600 space-y-2">
              <Text className="block">1. 在电脑浏览器中打开小红书网站并登录</Text>
              <Text className="block">2. 打开任意笔记页面</Text>
              <Text className="block">3. 按 F12 打开开发者工具，切换到 Network 标签</Text>
              <Text className="block">4. 刷新页面</Text>
              <Text className="block">5. 点击任意一个请求，找到 Request Headers</Text>
              <Text className="block">6. 找到 &quot;Cookie:&quot; 字段，复制后面的所有内容</Text>
              <Text className="block">7. 将内容粘贴到下方输入框中</Text>
            </View>
          </CardContent>
        </Card>

        {/* User-Agent */}
        <View className="mb-4">
          <Text className="block text-sm font-medium text-gray-700 mb-2">User-Agent（可选）</Text>
          <View className="bg-white rounded-xl px-4 py-3">
            <Input 
              className="text-sm"
              placeholder="点击获取当前设备的 User-Agent"
              value={userAgent}
              onInput={(e: any) => setUserAgent(e.target.value)}
            />
          </View>
          <Button 
            variant="ghost" 
            size="sm"
            className="mt-2"
            onClick={getUserAgent}
          >
            <Text className="text-xs text-gray-500">使用当前设备</Text>
          </Button>
        </View>

        {/* Cookies 输入 */}
        <View className="mb-4">
          <Text className="block text-sm font-medium text-gray-700 mb-2">
            Cookies <Text className="text-red-500">*</Text>
          </Text>
          <View className="bg-white rounded-xl px-4 py-3">
            <Input 
              className="text-sm"
              style={{ minHeight: '120px' }}
              placeholder={'粘贴 cookies 内容...\n\n支持两种格式：\n1. JSON 数组格式（从浏览器复制）\n2. 纯 Cookie 字符串格式'}
              value={cookies}
              onInput={(e: any) => setCookies(e.target.value)}
              type="textarea"
            />
          </View>
        </View>

        {/* 错误提示 */}
        {error && (
          <View className="mb-4 p-3 bg-red-50 rounded-xl border border-red-100">
            <Text className="block text-sm text-red-600">{error}</Text>
          </View>
        )}

        {/* 成功提示 */}
        {success && (
          <View className="mb-4 p-3 bg-green-50 rounded-xl border border-green-100">
            <Text className="block text-sm text-green-600">设置成功！现在可以尝试收录小红书视频了。</Text>
          </View>
        )}

        {/* 保存按钮 */}
        <Button 
          className="w-full bg-green-500 mb-4"
          onClick={handleSave}
          disabled={loading}
        >
          <Text className="text-white">{loading ? '保存中...' : '保存设置'}</Text>
        </Button>

        {/* 注意事项 */}
        <Card>
          <CardContent className="p-4">
            <Text className="block text-sm font-medium text-gray-900 mb-2">注意事项</Text>
            <View className="text-xs text-gray-500 space-y-2">
              <Text className="block">• Cookies 会保存在服务器端，不会泄露</Text>
              <Text className="block">• 建议每 7 天更新一次 cookies</Text>
              <Text className="block">• 如果仍无法获取内容，可能 cookies 已过期</Text>
              <Text className="block">• 部分视频可能因版权原因无法获取</Text>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  )
}
