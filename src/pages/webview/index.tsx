import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, WebView } from '@tarojs/components'

function WebviewPage() {
  useEffect(() => {
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const options = (currentPage as any)?.options || {}
    const url = decodeURIComponent(options.url || '')
    
    if (!url) {
      Taro.showToast({ title: '链接无效', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
    }
  }, [])

  const handleLoad = () => {
    console.log('[Webview] 页面加载成功')
  }

  const handleError = (e: any) => {
    console.error('[Webview] 加载失败:', e)
    Taro.showToast({ title: '页面加载失败', icon: 'none' })
  }

  // 获取 URL 参数
  const pages = Taro.getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = (currentPage as any)?.options || {}
  const url = decodeURIComponent(options.url || '')

  return (
    <View className="w-full h-full">
      {url ? (
        <WebView
          src={url}
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : (
        <View className="flex items-center justify-center h-full">
          <View>加载中...</View>
        </View>
      )}
    </View>
  )
}

export default WebviewPage
