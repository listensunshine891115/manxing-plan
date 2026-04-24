export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '投票选择' })
  : { navigationBarTitleText: '投票选择' }
