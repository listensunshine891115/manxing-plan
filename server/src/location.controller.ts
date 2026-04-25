import { Controller, Post, Body } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';

@Controller('location')
export class LocationController {
  @Post('reverse')
  async reverseGeocode(
    @Body() body: { lat: number; lng: number }
  ): Promise<{ status: string; data: { address?: string; name?: string } }> {
    const { lat, lng } = body;
    
    // 这里可以使用高德或腾讯的逆地址解析 API
    // 由于没有配置外部 API，暂时返回一个模拟地址
    // 实际项目中应该调用真实的逆地址解析服务
    
    // 模拟返回（实际应该调用高德/腾讯逆地理编码 API）
    const mockAddress = `坐标位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    
    return {
      status: 'success',
      data: {
        address: mockAddress,
        name: '选择的地点'
      }
    };
  }
}
