import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { DecodedIdToken } from '@workspace/firebase';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { parseBody } from '../common/zod-parse';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

type AdminRequest = { user?: DecodedIdToken };

const SuspendBody = z.object({ reason: z.string().max(500).nullish() });
const ReviewBody = z.object({ note: z.string().max(1000).nullish() });
const SettingsBody = z.object({ values: z.record(z.string(), z.union([z.number(), z.boolean(), z.null()])) });

/**
 * Admin panel API (artifacts/admin-web). Not part of the rider OpenAPI contract: admins sign in
 * with email + password and must be listed in Firestore `admins/{uid}`.
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

  @Post('users/:uid/suspend')
  @HttpCode(200)
  suspend(@Req() req: AdminRequest, @Param('uid') uid: string, @Body() body: unknown) {
    return this.admin.suspend(uid, parseBody(SuspendBody, body ?? {}).reason ?? null, req.user!.email ?? null);
  }

  @Post('users/:uid/reinstate')
  @HttpCode(200)
  reinstate(@Req() req: AdminRequest, @Param('uid') uid: string) {
    return this.admin.reinstate(uid, req.user!.email ?? null);
  }

  @Get('reports')
  reports(@Query('status') status?: string) {
    const filter = status === 'reviewed' || status === 'all' ? status : 'open';
    return this.admin.listReports(filter);
  }

  @Post('reports/:id/review')
  @HttpCode(200)
  review(@Req() req: AdminRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.admin.reviewReport(id, parseBody(ReviewBody, body ?? {}).note ?? null, req.user!.email ?? null);
  }

  @Get('rooms')
  rooms() {
    return this.admin.listRooms();
  }

  @Post('rooms/:roomId/close')
  @HttpCode(200)
  closeRoom(@Param('roomId') roomId: string) {
    return this.admin.closeRoom(roomId);
  }

  @Get('safety-alerts')
  safetyAlerts() {
    return this.admin.listSafetyAlerts();
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
