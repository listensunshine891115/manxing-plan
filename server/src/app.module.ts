import { Module } from '@nestjs/common'
import { AppController } from '@/app.controller'
import { AppService } from '@/app.service'
import { TripController } from '@/trip.controller'
import { TripService } from '@/trip.service'
import { MessageController } from '@/message.controller'
import { ParseService } from '@/parse.service'
import { UserService } from '@/user.service'
import { AsrService } from '@/asr.service'
import { AudioService } from '@/audio.service'
import { VideoParseService } from '@/video-parse.service'
import { MapService } from '@/map.service'
import { VoteController } from '@/vote.controller'
import { VoteService } from '@/vote.service'
import { LocationController } from '@/location.controller'
import { NotificationController } from '@/notification.controller'
import { NotificationService } from '@/notification.service'

@Module({
  imports: [],
  controllers: [AppController, TripController, MessageController, VoteController, LocationController, NotificationController],
  providers: [
    AppService,
    TripService,
    ParseService,
    UserService,
    AsrService,
    AudioService,
    VideoParseService,
    MapService,
    VoteService,
    NotificationService,
  ],
})
export class AppModule {}
