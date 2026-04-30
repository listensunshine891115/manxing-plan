export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '路线方案',
      enableShareAppMessage: true,
      enableShareTimeline: true,
    })
  : { navigationBarTitleText: '路线方案' }
