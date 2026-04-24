export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '确认行程' })
  : { navigationBarTitleText: '确认行程' }
