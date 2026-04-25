import { Injectable } from '@nestjs/common'

@Injectable()
export class MapService {

  /**
   * 地理编码：将地址转换为经纬度（使用 Nominatim 免费服务）
   * @param address 地址
   * @param city 城市名（可选）
   */
  async geocode(address: string, city?: string): Promise<{ lat: number; lng: number } | null> {
    try {
      // 构造查询地址
      const searchQuery = city ? `${address}, ${city}, China` : `${address}, China`
      const encodedQuery = encodeURIComponent(searchQuery)
      
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1&countrycodes=cn`
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ManxingApp/1.0' // Nominatim 要求 User-Agent
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
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
   * 关键词搜索：搜索地点并返回位置信息（使用 Nominatim）
   */
  async searchPlace(keywords: string, city?: string): Promise<{ 
    name: string
    address: string
    lat: number
    lng: number
  }[] | null> {
    try {
      const searchQuery = city ? `${keywords}, ${city}, China` : `${keywords}, China`
      const encodedQuery = encodeURIComponent(searchQuery)
      
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5&countrycodes=cn`
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ManxingApp/1.0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data && data.length > 0) {
        return data.map((item: any) => ({
          name: item.display_name.split(',')[0],
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }))
      }
      
      return null
    } catch (error) {
      console.error(`[MapService] 搜索失败: ${keywords}`, error)
      return null
    }
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

    // 使用最近邻算法优化路线（使用实际道路距离）
    const optimizedRoute = await this.nearestNeighborRoute(validPoints)

    // 计算相邻点之间的距离（使用实际道路距离）
    const routeWithDistance: Array<{
      id: string
      title: string
      lat: number
      lng: number
      location: string
      distance?: number
    }> = []
    for (let index = 0; index < optimizedRoute.length; index++) {
      const point = optimizedRoute[index]
      const nextPoint = optimizedRoute[index + 1]
      if (nextPoint) {
        const distance = await this.getDrivingDistance(
          { lat: point.lat, lng: point.lng },
          { lat: nextPoint.lat, lng: nextPoint.lng }
        )
        routeWithDistance.push({ ...point, distance })
      } else {
        routeWithDistance.push(point)
      }
    }

    console.log(`[MapService] 路线优化完成，使用道路距离计算`)
    return routeWithDistance
  }

  /**
   * 计算两点之间的直线距离（Haversine 公式）
   */
  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
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
   * 获取两点之间的实际道路距离（使用 OSRM 路线规划 API）
   * @param origin 起点 { lat, lng }
   * @param destination 终点 { lat, lng }
   * @returns 距离（米），如果失败返回 -1
   */
  async getDrivingDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<number> {
    try {
      // 使用 OSRM 公共路线规划服务（免费开源）
      const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const distance = data.routes[0].distance // 单位是米
        console.log(`[MapService] 道路距离: ${origin} -> ${destination} = ${Math.round(distance)}米`)
        return Math.round(distance)
      }
      
      console.log(`[MapService] OSRM 无结果，使用直线距离`)
      return this.calculateDistance(origin, destination)
    } catch (error) {
      console.error(`[MapService] OSRM 请求失败:`, error)
      // 降级使用直线距离估算
      const straightDistance = this.calculateDistance(origin, destination)
      return Math.round(straightDistance * 1.4)
    }
  }

  /**
   * 获取两点之间的步行距离（使用 OSRM 路线规划 API）
   */
  async getWalkingDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<number> {
    try {
      const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        return Math.round(data.routes[0].distance)
      }
      
      return this.calculateDistance(origin, destination)
    } catch (error) {
      console.error(`[MapService] OSRM 步行路线请求失败:`, error)
      const straightDistance = this.calculateDistance(origin, destination)
      return Math.round(straightDistance * 1.2)
    }
  }

  /**
   * 最近邻算法：贪心策略优化路线
   * 使用实际道路距离进行排序
   */
  async nearestNeighborRoute(points: Array<{
    id: string
    title: string
    lat: number
    lng: number
    location: string
  }>): Promise<Array<{
    id: string
    title: string
    lat: number
    lng: number
    location: string
  }>> {
    if (points.length === 0) return []

    const route: typeof points = []
    const remaining = [...points]

    // 选择最偏南的点作为起点（或者第一个点作为起点）
    let current = remaining.shift()!
    route.push(current)

    // 缓存距离计算结果，避免重复请求
    const distanceCache = new Map<string, number>()

    const getDistance = async (p1: typeof points[0], p2: typeof points[0]): Promise<number> => {
      const key = `${p1.id}-${p2.id}`
      const reverseKey = `${p2.id}-${p1.id}`
      
      if (distanceCache.has(key)) return distanceCache.get(key)!
      if (distanceCache.has(reverseKey)) return distanceCache.get(reverseKey)!
      
      const distance = await this.getDrivingDistance(
        { lat: p1.lat, lng: p1.lng },
        { lat: p2.lat, lng: p2.lng }
      )
      distanceCache.set(key, distance)
      return distance
    }

    while (remaining.length > 0) {
      // 找到距离当前点最近的点
      let nearestIndex = 0
      let nearestDistance = Infinity

      // 并行计算所有候选距离
      const distancePromises = remaining.map(async (point, index) => {
        const distance = await getDistance(current, point)
        return { index, distance }
      })

      const distances = await Promise.all(distancePromises)

      // 找到最小距离
      for (const { index, distance } of distances) {
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = index
        }
      }

      // 移除并添加到路线
      current = remaining.splice(nearestIndex, 1)[0]
      route.push(current)
      
      console.log(`[MapService] 路线优化: 选择 "${current.title}", 距离上一站 ${nearestDistance}米`)
    }

    console.log(`[MapService] 路线优化完成，总站点: ${route.length}`)
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
