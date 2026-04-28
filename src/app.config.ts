export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/category/index',
    'pages/select/index',
    'pages/favorites/index',
    'pages/bind-guide/index',
    'pages/settings/index',
    'pages/generate/index',
    'pages/confirm/index',
    'pages/route/index',
    'pages/vote/index',
    'pages/vote-result/index',
    'pages/preview/index',
    'pages/webview/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '此刻与你漫行',
    navigationBarTextStyle: 'black'
  },
  permission: {
    "scope.userLocation": {
      desc: "你的位置信息将用于确定集合地点"
    }
  },
  requiredPrivateInfos: ["getLocation"]
})
