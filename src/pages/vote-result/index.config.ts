export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '投票结果' })
  : { navigationBarTitleText: '投票结果' }
