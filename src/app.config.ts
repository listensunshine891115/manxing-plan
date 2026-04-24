export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/generate/index',
    'pages/route/index',
    'pages/vote/index',
    'pages/vote-result/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '旅行路线生成器',
    navigationBarTextStyle: 'black'
  }
})
