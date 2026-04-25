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

@Module({
  imports: [],
  controllers: [AppController, TripController, MessageController, VoteController],
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
  ],
})
export class AppModule {}
