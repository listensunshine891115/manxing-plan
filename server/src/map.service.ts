import { Injectable } from '@nestjs/common'

// 高德地图 API 配置
const AMAP_KEY = process.env.AMAP_KEY || ''
const AMAP_BASE_URL = 'https://restapi.amap.com/v3'

@Injectable()
export class MapService {

  /**
   * 地理编码：将地址转换为经纬度
   * @param address 地址（如 "北京市朝阳区xxx" 或 "厦门大学"）
   * @param city 城市名（可选，用于提高匹配精度）
   */
  async geocode(address: string, city?: string): Promise<{ lat: number; lng: number } | null> {
    if (!AMAP_KEY) {
      console.warn('[MapService] 高德地图 KEY 未配置，使用模拟坐标')
      return this.getMockLocation(address)
    }

    try {
      const params = new URLSearchParams({
        key: AMAP_KEY,
        address,
        ...(city && { city })
      })

      const response = await fetch(`${AMAP_BASE_URL}/geocode/geo?${params}`)
      const data = await response.json()

      if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
        const location = data.geocodes[0].location
        const [lng, lat] = location.split(',').map(Number)
        console.log(`[MapService] 地理编码成功: ${address} -> (${lat}, ${lng})`)
        return { lat, lng }
      }

      console.log(`[MapService] 地理编码无结果: ${address}`)
      return null
    } catch (error) {
      console.error(`[MapService] 地理编码失败: ${address}`, error)
      return null
    }
  }

  /**
   * 关键词搜索：搜索地点并返回位置信息
   * @param keywords 关键词
   * @param city 城市名
   */
  async searchPlace(keywords: string, city?: string): Promise<{ 
    name: string
    address: string
    lat: number
    lng: number
  }[] | null> {
    if (!AMAP_KEY) {
      console.warn('[MapService] 高德地图 KEY 未配置')
      return null
    }

    try {
      const params = new URLSearchParams({
        key: AMAP_KEY,
        keywords,
        types: '风景名胜|美食|购物|酒店|景点',
        ...(city && { city }),
        offset: '5' // 限制返回数量
      })

      const response = await fetch(`${AMAP_BASE_URL}/place/text?${params}`)
      const data = await response.json()

      if (data.status === '1' && data.pois && data.pois.length > 0) {
        return data.pois.map((poi: any) => ({
          name: poi.name,
          address: poi.address || '',
          lat: parseFloat(poi.location.split(',')[1]),
          lng: parseFloat(poi.location.split(',')[0])
        }))
      }

      return null
    } catch (error) {
      console.error(`[MapService] 地点搜索失败: ${keywords}`, error)
      return null
    }
  }

  /**
   * 计算两点之间的距离（直线距离）
   */
  calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371 // 地球半径（公里）
    const dLat = this.toRad(point2.lat - point1.lat)
    const dLng = this.toRad(point2.lng - point1.lng)
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(point1.lat)) * Math.cos(this.toRad(point2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2)
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180)
  }

  /**
   * 智能排序灵感点：基于地理位置优化顺序
   * 使用最近邻算法优化路线
   */
  async optimizeRoute(
    inspirations: Array<{
      id: string
      title: string
      location?: string
      lat?: number
      lng?: number
    }>,
    mainDestination?: string
  ): Promise<Array<{
    id: string
    title: string
    lat: number
    lng: number
    location: string
    distance?: number // 到下一个点的距离
  }>> {
    console.log(`[MapService] 开始优化路线，共 ${inspirations.length} 个点`)

    // 第一步：获取所有点的经纬度
    const pointsWithCoords = await Promise.all(
      inspirations.map(async (ins) => {
        // 如果已有坐标，直接使用
        if (ins.lat && ins.lng) {
          return {
            id: ins.id,
            title: ins.title,
            lat: ins.lat,
            lng: ins.lng,
            location: ins.location || ins.title
          }
        }

        // 如果有位置信息，尝试地理编码
        if (ins.location) {
          const coords = await this.geocode(ins.location)
          if (coords) {
            return {
              id: ins.id,
              title: ins.title,
              ...coords,
              location: ins.location
            }
          }

          // 尝试关键词搜索
          const searchResults = await this.searchPlace(ins.title, this.extractCity(ins.location))
          if (searchResults && searchResults.length > 0) {
            return {
              id: ins.id,
              title: ins.title,
              lat: searchResults[0].lat,
              lng: searchResults[0].lng,
              location: searchResults[0].address || ins.title
            }
          }
        }

        // 如果有主目的地，尝试在该城市搜索
        if (mainDestination) {
          const searchResults = await this.searchPlace(ins.title, mainDestination)
          if (searchResults && searchResults.length > 0) {
            return {
              id: ins.id,
              title: ins.title,
              lat: searchResults[0].lat,
              lng: searchResults[0].lng,
              location: searchResults[0].address || ins.title
            }
          }
        }

        // 无法获取坐标，返回 null
        console.warn(`[MapService] 无法获取位置: ${ins.title}`)
        return null
      })
    )

    // 过滤掉无法获取坐标的点
    const validPoints = pointsWithCoords.filter((p): p is NonNullable<typeof p> => p !== null)
    console.log(`[MapService] 有效点数: ${validPoints.length}/${inspirations.length}`)

    if (validPoints.length === 0) {
      return []
    }

    // 如果只有一个点，直接返回
    if (validPoints.length === 1) {
      return validPoints.map(p => ({ ...p, distance: 0 }))
    }

    // 使用最近邻算法优化路线
    const optimizedRoute = this.nearestNeighborRoute(validPoints)

    // 计算相邻点之间的距离
    const routeWithDistance = optimizedRoute.map((point, index) => {
      const nextPoint = optimizedRoute[index + 1]
      if (nextPoint) {
        const distance = this.calculateDistance(point, nextPoint)
        return { ...point, distance }
      }
      return point
    })

    console.log(`[MapService] 路线优化完成`)
    return routeWithDistance
  }

  /**
   * 最近邻算法：贪心策略优化路线
   */
  private nearestNeighborRoute(points: Array<{
    id: string
    title: string
    lat: number
    lng: number
    location: string
  }>): Array<{
    id: string
    title: string
    lat: number
    lng: number
    location: string
  }> {
    if (points.length === 0) return []

    const route: typeof points = []
    const remaining = [...points]

    // 选择最偏南的点作为起点（或者第一个点作为起点）
    let current = remaining.shift()!
    route.push(current)

    while (remaining.length > 0) {
      // 找到距离当前点最近的点
      let nearestIndex = 0
      let nearestDistance = Infinity

      for (let i = 0; i < remaining.length; i++) {
        const distance = this.calculateDistance(current, remaining[i])
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = i
        }
      }

      // 移除并添加到路线
      current = remaining.splice(nearestIndex, 1)[0]
      route.push(current)
    }

    return route
  }

  /**
   * 从地址中提取城市名
   */
  private extractCity(location: string): string | undefined {
    // 常见城市后缀
    const suffixes = ['市', '省', '区', '县']
    
    for (const suffix of suffixes) {
      const index = location.indexOf(suffix)
      if (index > 0 && index < 10) { // 确保在城市名前面
        const potentialCity = location.substring(0, index + 1)
        // 检查是否是有效的城市名
        if (potentialCity.length >= 2) {
          return potentialCity
        }
      }
    }

    // 默认返回前4个字符（可能是城市名）
    return location.length >= 4 ? location.substring(0, 4) : undefined
  }

  /**
   * 模拟坐标（当没有配置高德 KEY 时使用）
   * 基于名称生成伪随机但稳定的坐标
   */
  private getMockLocation(name: string): { lat: number; lng: number } {
    // 简单hash生成稳定坐标
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i)
      hash = hash & hash
    }

    // 默认在中国范围内的随机坐标（模拟）
    const lat = 30 + (hash % 100) / 100 * 10 // 30-40
    const lng = 110 + ((hash >> 8) % 100) / 100 * 20 // 110-130

    return { lat, lng }
  }

  /**
   * 批量获取位置信息
   * 优先使用已有坐标，然后尝试获取缺失的
   */
  async enrichLocations(inspirations: Array<{
    id: string
    title: string
    location?: string
    lat?: number
    lng?: number
  }>, mainDestination?: string): Promise<Array<{
    id: string
    title: string
    location?: string
    lat?: number
    lng?: number
    locationSource: 'original' | 'geocoded' | 'searched' | 'failed'
  }>> {
    const results = await Promise.all(
      inspirations.map(async (ins) => {
        // 已有坐标
        if (ins.lat && ins.lng) {
          return {
            ...ins,
            locationSource: 'original' as const
          }
        }

        // 有位置信息，尝试地理编码
        if (ins.location) {
          const coords = await this.geocode(ins.location)
          if (coords) {
            return {
              ...ins,
              ...coords,
              locationSource: 'geocoded' as const
            }
          }
        }

        // 尝试关键词搜索
        if (mainDestination) {
          const searchResults = await this.searchPlace(ins.title, mainDestination)
          if (searchResults && searchResults.length > 0) {
            return {
              ...ins,
              lat: searchResults[0].lat,
              lng: searchResults[0].lng,
              location: searchResults[0].address || ins.location,
              locationSource: 'searched' as const
            }
          }
        }

        // 无法获取
        return {
          ...ins,
          locationSource: 'failed' as const
        }
      })
    )

    return results
  }
}
