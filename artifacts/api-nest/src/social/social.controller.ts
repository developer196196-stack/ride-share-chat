import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { DecodedIdToken } from '@workspace/firebase';
import { InviteToRoomBody } from '@workspace/api-zod';
import type { ErrorResponseBody } from '../common/error-response';
import { parseBody } from '../common/zod-parse';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RoomsService } from '../rooms/rooms.service';
import { SocialService } from './social.service';

type AuthedRequest = { user?: DecodedIdToken };

@Controller('v1')
@UseGuards(FirebaseAuthGuard)
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly rooms: RoomsService,
  ) {}

  @Get('users/:uid')
  profile(@Req() req: AuthedRequest, @Param('uid') uid: string) {
    return this.social.profile(req.user!.uid, uid);
  }

  @Post('users/:uid/follow')
  @HttpCode(200)
  follow(@Req() req: AuthedRequest, @Param('uid') uid: string) {
    return this.social.follow(req.user!.uid, uid);
  }

  @Delete('users/:uid/follow')
  unfollow(@Req() req: AuthedRequest, @Param('uid') uid: string) {
    return this.social.unfollow(req.user!.uid, uid);
  }

  @Get('me/following')
  following(@Req() req: AuthedRequest) {
    return this.social.listFollowing(req.user!.uid);
  }

  @Get('me/followers')
  followers(@Req() req: AuthedRequest) {
    return this.social.listFollowers(req.user!.uid);
  }

  /** Host invite: only riders in the host's network (either follows the other). */
  @Post('rooms/current/invites')
  @HttpCode(200)
  async invite(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { uid: target } = parseBody(InviteToRoomBody, body);
    if (!(await this.social.isConnected(req.user!.uid, target))) {
      const error: ErrorResponseBody = { code: 'NOT_IN_NETWORK', message: 'You can invite riders you follow or who follow you.' };
      throw new NotFoundException(error);
    }
    return this.rooms.invite(req.user!.uid, target);
  }

  /** Join request: only friends of the host (mutual follows) can see the room, so only they can ask. */
  @Post('rooms/:roomId/requests')
  @HttpCode(200)
  async request(@Req() req: AuthedRequest, @Param('roomId') roomId: string) {
    const host = await this.rooms.hostOf(roomId);
    if (!(await this.social.areFriends(req.user!.uid, host))) {
      const error: ErrorResponseBody = { code: 'NOT_FRIENDS', message: 'Only friends of the host can ask to join.' };
      throw new ForbiddenException(error);
    }
    return this.rooms.requestToJoin(req.user!.uid, roomId);
  }

  @Get('rooms/current/requests')
  requests(@Req() req: AuthedRequest) {
    return this.rooms.listRequests(req.user!.uid);
  }

  @Post('rooms/current/requests/:uid/accept')
  @HttpCode(200)
  accept(@Req() req: AuthedRequest, @Param('uid') uid: string) {
    return this.rooms.acceptRequest(req.user!.uid, uid);
  }

  @Post('rooms/current/requests/:uid/decline')
  @HttpCode(200)
  decline(@Req() req: AuthedRequest, @Param('uid') uid: string) {
    return this.rooms.declineRequest(req.user!.uid, uid);
  }
}
