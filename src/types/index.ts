// 灵感数据类型
export interface Inspiration {
  id: string
  title: string
  image: string
  source: 'xiaohongshu' | 'dazhong' | 'damai' | 'other'
  type: 'spot' | 'food' | 'show' | 'hotel'
  location: {
    name: string
    lat: number
    lng: number
  }
  time?: string
  price?: number
  rating?: number
  createTime?: string | number
}

// 行程天数数据
export interface TripDay {
  day: number
  date: string
  items: TripItem[]
}

// 单个行程项
export interface TripItem {
  id: string
  inspirationId: string
  title: string
  image: string
  location: {
    name: string
    lat: number
    lng: number
  }
  startTime?: string
  endTime?: string
  type: 'spot' | 'food' | 'show' | 'hotel'
  duration?: number // 预计停留时间（分钟）
  note?: string
}

// 路线版本
export interface TripVersion {
  id: string
  versionName: string
  content: TripDay[]
  voteCount: number
  isFinal: boolean
  createTime: number
}

// 路线生成设置
export interface TripSettings {
  startDate: string
  days: number
  budget?: number
  transportMode: 'public' | 'self-drive'
}

// 投票数据
export interface Vote {
  id: string
  tripId: string
  voterId: string
  voterName: string
  versionId: string
  createTime: number
}

// 分享收集的数据
export interface SharedContent {
  url: string
  title: string
  image?: string
  type?: 'spot' | 'food' | 'show' | 'hotel'
}
