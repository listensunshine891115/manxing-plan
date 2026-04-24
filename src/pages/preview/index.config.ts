export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '功能预览' })
  : { navigationBarTitleText: '功能预览' }
