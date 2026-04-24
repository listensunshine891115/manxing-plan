export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '生成路线' })
  : { navigationBarTitleText: '生成路线' }
