export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '小红书登录设置' })
  : { navigationBarTitleText: '小红书登录设置' }
