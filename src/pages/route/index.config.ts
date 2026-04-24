export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '路线方案' })
  : { navigationBarTitleText: '路线方案' }
