import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { QrCode, Copy } from 'lucide-react-taro'

// 公众号二维码 URL（用户提供的）
const OFFICIAL_ACCOUNT_QR = 'https://mmbiz.qpic.cn/mmbiz_jpg/hWniafLniajBict9iaNibLicE3qicrQibibM4W7r3icicZicicLwicicfWib9a9L3P7T5ic8icicX7qL5P3g7h7icicYqYsicEib7kibibTjQ/0?wx_fmt=jpeg'

export default function BindGuide() {
  // 获取全局状态中的用户码
  const userCode = (Taro.getStorageSync('userInfo') as any)?.userCode || '------'

  const handleCopyCode = () => {
    Taro.setClipboardData({
      data: userCode,
      success: () => {
        Taro.showToast({ title: '已复制', icon: 'success' })
      }
    })
  }

  const handleSkip = () => {
    // 跳转到主页
    Taro.redirectTo({ url: '/pages/index/index' })
  }

  return (
    <View className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* 顶部区域 */}
      <View className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        {/* 图标 */}
        <View className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mb-8 shadow-lg">
          <Text className="text-4xl">📱</Text>
        </View>

        {/* 标题 */}
        <Text className="block text-2xl font-bold text-gray-800 mb-3">
          绑定公众号
        </Text>
        <Text className="block text-base text-gray-500 text-center mb-10 leading-relaxed">
          绑定后，可将旅行灵感链接{'\n'}发送至公众号自动收录
        </Text>

        {/* 方式一：扫码绑定 */}
        <View className="w-full bg-white rounded-2xl p-6 shadow-sm mb-4">
          <View className="flex items-center mb-4">
            <View className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
              <QrCode size={18} color="#1890ff" />
            </View>
            <Text className="block text-base font-medium text-gray-800">方式一：扫码绑定</Text>
          </View>
          <View className="bg-gray-50 rounded-xl p-4 flex flex-col items-center">
            <Image
              src={OFFICIAL_ACCOUNT_QR}
              className="w-48 h-48 rounded-lg mb-3"
              mode="aspectFit"
            />
            <Text className="block text-sm text-gray-500">微信扫一扫关注公众号</Text>
          </View>
        </View>

        {/* 方式二：用户码绑定 */}
        <View className="w-full bg-white rounded-2xl p-6 shadow-sm mb-6">
          <View className="flex items-center mb-4">
            <View className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
              <Text className="text-lg">🔑</Text>
            </View>
            <Text className="block text-base font-medium text-gray-800">方式二：用户码绑定</Text>
          </View>
          <View className="bg-gray-50 rounded-xl p-4">
            <Text className="block text-sm text-gray-500 mb-3">发送「绑定#用户码」给公众号</Text>
            <View className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-200">
              <Text className="block text-2xl font-mono font-bold text-blue-600 tracking-wider">
                {userCode}
              </Text>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="ml-4"
              >
                <Copy size={16} color="#3b82f6" />
                <Text className="block ml-1">复制</Text>
              </Button>
            </View>
          </View>
        </View>

        {/* 绑定步骤 */}
        <View className="w-full bg-blue-50 rounded-2xl p-4">
          <Text className="block text-sm font-medium text-blue-800 mb-3">绑定步骤</Text>
          <View className="space-y-2">
            <View className="flex items-center">
              <View className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <Text className="block text-xs text-white">1</Text>
              </View>
              <Text className="block text-sm text-gray-600">微信扫二维码或搜索公众号</Text>
            </View>
            <View className="flex items-center">
              <View className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <Text className="block text-xs text-white">2</Text>
              </View>
              <Text className="block text-sm text-gray-600">发送「绑定#{userCode}」</Text>
            </View>
            <View className="flex items-center">
              <View className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <Text className="block text-xs text-white">3</Text>
              </View>
              <Text className="block text-sm text-gray-600">收到绑定成功通知</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 底部按钮 */}
      <View className="p-6 pb-10">
        <View className="space-y-3">
          <Button
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            onClick={handleSkip}
          >
            <Text className="block">进入主页</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}
