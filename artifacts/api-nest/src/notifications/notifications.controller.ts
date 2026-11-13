import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { DecodedIdToken } from '@workspace/firebase';
import { RegisterPushTokenBody, RemovePushTokenBody } from '@workspace/api-zod';
import { parseBody } from '../common/zod-parse';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PushService } from './push.service';

type AuthedRequest = { user?: DecodedIdToken };

@Controller('v1/me/push-tokens')
@UseGuards(FirebaseAuthGuard)
export class NotificationsController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(204)
  async register(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { token, platform } = parseBody(RegisterPushTokenBody, body);
    await this.push.register(req.user!.uid, token, platform);
  }

  @Post('remove')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Body() body: unknown) {
    await this.push.unregister(req.user!.uid, parseBody(RemovePushTokenBody, body).token);
  }
}
