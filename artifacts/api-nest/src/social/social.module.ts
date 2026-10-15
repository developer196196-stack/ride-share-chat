import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

/** Follow graph, friends riding now, room invites and join requests. */
@Module({
  imports: [AuthModule, RoomsModule],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
