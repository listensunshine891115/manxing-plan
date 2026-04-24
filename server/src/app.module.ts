import { Module } from '@nestjs/common'
import { AppController } from '@/app.controller'
import { AppService } from '@/app.service'
import { TripController } from '@/trip.controller'
import { TripService } from '@/trip.service'
import { MessageController } from '@/message.controller'
import { ParseService } from '@/parse.service'

@Module({
  imports: [],
  controllers: [AppController, TripController, MessageController],
  providers: [AppService, TripService, ParseService],
})
export class AppModule {}
