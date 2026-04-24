import { Controller, Get } from '@nestjs/common';
import { AppService } from '@/app.service';
import { AsrService } from '@/asr.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly asrService: AsrService,
  ) {}

  @Get('hello')
  getHello(): { status: string; data: string } {
    return {
      status: 'success',
      data: this.appService.getHello()
    };
  }

  @Get('health')
  getHealth(): { status: string; asr: { baidu: boolean; xunfei: boolean } } {
    return {
      status: 'success',
      asr: this.asrService.getConfigStatus(),
    };
  }
}
