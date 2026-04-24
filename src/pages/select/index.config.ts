export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '选择灵感点' })
  : { navigationBarTitleText: '选择灵感点' }
