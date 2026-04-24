export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '选择灵感' })
  : { navigationBarTitleText: '选择灵感' }
