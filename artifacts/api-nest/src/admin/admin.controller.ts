import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { DecodedIdToken } from '@workspace/firebase';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { parseBody } from '../common/zod-parse';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

type AdminRequest = { user?: DecodedIdToken };

const SettingsBody = z.object({ values: z.record(z.string(), z.union([z.number(), z.boolean(), z.null()])) });

/**
 * Admin panel API (artifacts/admin-web). Not part of the rider OpenAPI contract: admins sign in
 * with email + password and must be listed in Firestore `admins/{uid}`. This edition covers the overview,
 * riders (read-only) and Trip Validation settings.
 */
@Controller('v1/admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('me')
  me(@Req() req: AdminRequest) {
    return { uid: req.user!.uid, email: req.user!.email ?? null };
  }

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('users')
  users(@Query('search') search?: string) {
    return this.admin.listUsers(search);
  }

  @Get('users/:uid')
  user(@Param('uid') uid: string) {
    return this.admin.getUser(uid);
  }

  @Get('settings/validation')
  validationSettings() {
    return this.admin.getValidationSettings();
  }

  @Put('settings/validation')
  updateValidationSettings(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.admin.updateValidationSettings(parseBody(SettingsBody, body).values, req.user!.email ?? null);
  }
}
