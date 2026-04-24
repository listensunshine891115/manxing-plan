export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '旅行灵感' })
  : { navigationBarTitleText: '旅行灵感' }
