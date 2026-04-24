import { Module } from '@nestjs/common'
import { AppController } from '@/app.controller'
import { AppService } from '@/app.service'
import { TripController } from '@/trip.controller'
import { TripService } from '@/trip.service'

@Module({
  imports: [],
  controllers: [AppController, TripController],
  providers: [AppService, TripService],
})
export class AppModule {}
