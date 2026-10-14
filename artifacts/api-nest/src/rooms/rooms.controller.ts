import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { DecodedIdToken } from '@workspace/firebase';
import { HostRoomBody, JoinRoomBody, UpdateRoomSettingsBody } from '@workspace/api-zod';
import { parseBody, validationError } from '../common/zod-parse';
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

  @Get('rooms/discover')
  discover(@Req() req: AuthedRequest) {
    return this.rooms.discover(req.user!.uid);
  }

  @Post('rooms/host')
  @HttpCode(200)
  host(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.rooms.host(req.user!.uid, parseBody(HostRoomBody, body).vibe);
  }

  @Post('rooms/:roomId/join')
  @HttpCode(200)
  joinById(@Req() req: AuthedRequest, @Param('roomId') roomId: string) {
    return this.rooms.joinById(req.user!.uid, roomId);
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

  @Patch('rooms/current/settings')
  updateSettings(@Req() req: AuthedRequest, @Body() body: unknown) {
    const update = parseBody(UpdateRoomSettingsBody, body);
    if (update.vibe == null && update.matching == null && update.locked == null) {
      validationError('Send at least one of vibe, matching or locked.');
    }
    return this.rooms.updateSettings(req.user!.uid, update);
  }

  @Post('rooms/current/members/:uid/eject')
  @HttpCode(200)
  eject(@Req() req: AuthedRequest, @Param('uid') uid: string) {
    return this.rooms.eject(req.user!.uid, uid);
  }

  @Post('rooms/current/members/:uid/mute')
  @HttpCode(200)
  mute(@Req() req: AuthedRequest, @Param('uid') uid: string) {
    return this.rooms.forceMute(req.user!.uid, uid);
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
