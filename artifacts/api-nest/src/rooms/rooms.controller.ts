import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { DecodedIdToken } from '@workspace/firebase';
import { JoinRoomBody } from '@workspace/api-zod';
import { parseBody } from '../common/zod-parse';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ChatService } from '../chat/chat.service';
import { RoomsService } from './rooms.service';

type AuthedRequest = { user?: DecodedIdToken };

@Controller('v1')
@UseGuards(FirebaseAuthGuard)
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly chat: ChatService,
  ) {}

  @Get('rooms/vibes')
  vibes() {
    return this.rooms.vibeStats();
  }

  @Get('rooms/current')
  async current(@Req() req: AuthedRequest) {
    return { room: await this.rooms.getCurrent(req.user!.uid) };
  }

  @Post('rooms/join')
  @HttpCode(200)
  join(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.rooms.join(req.user!.uid, parseBody(JoinRoomBody, body).vibe);
  }

  @Post('rooms/next')
  @HttpCode(200)
  next(@Req() req: AuthedRequest) {
    return this.rooms.next(req.user!.uid);
  }

  @Post('rooms/leave')
  @HttpCode(200)
  leave(@Req() req: AuthedRequest) {
    return this.rooms.endRide(req.user!.uid);
  }

  @Get('rooms/current/messages')
  messages(@Req() req: AuthedRequest) {
    return this.chat.recent(req.user!.uid);
  }

  @Get('rides')
  rides(@Req() req: AuthedRequest) {
    return this.rooms.listRides(req.user!.uid);
  }
}
