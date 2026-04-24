export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '我的收藏' })
  : { navigationBarTitleText: '我的收藏' }
