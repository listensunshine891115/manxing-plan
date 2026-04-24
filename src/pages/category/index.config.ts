export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '灵感库' })
  : { navigationBarTitleText: '灵感库' }
