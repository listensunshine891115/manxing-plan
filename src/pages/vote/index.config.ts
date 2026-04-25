export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '同伴投票',
      enableShareAppMessage: true,
      enableShareTimeline: true,
    })
  : { navigationBarTitleText: '同伴投票' }
