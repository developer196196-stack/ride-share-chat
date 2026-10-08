import { Body, Controller, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { DecodedIdToken } from '@workspace/firebase';
import {
  BootstrapAuthBody,
  CreateProfilePhotoUploadBody,
  UpdateAuthMeBody,
} from '@workspace/api-zod';
import { parseBody } from '../common/zod-parse';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { AuthService } from './auth.service';

type AuthedRequest = { user?: DecodedIdToken };

@Controller('v1/auth')
@UseGuards(FirebaseAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('bootstrap')
  @HttpCode(200)
  bootstrap(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.authService.bootstrap(req.user!, parseBody(BootstrapAuthBody, body ?? {}));
  }

  @Get('me')
  getMe(@Req() req: AuthedRequest) {
    return this.authService.getMe(req.user!);
  }

  @Patch('me')
  updateMe(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.authService.updateMe(req.user!, parseBody(UpdateAuthMeBody, body));
  }

  @Post('me/photo-upload')
  @HttpCode(200)
  createPhotoUpload(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.authService.createPhotoUpload(
      req.user!,
      parseBody(CreateProfilePhotoUploadBody, body),
    );
  }
}
