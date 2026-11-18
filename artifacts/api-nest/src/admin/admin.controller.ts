import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { DecodedIdToken } from '@workspace/firebase';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { parseBody } from '../common/zod-parse';
import { AdminGuard } from './admin.guard';
import { RoomCategoriesService } from '../rooms/room-categories.service';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../rooms/room-categories';
import { AdminService } from './admin.service';

type AdminRequest = { user?: DecodedIdToken };

const SuspendBody = z.object({ reason: z.string().max(500).nullish() });
const ReviewBody = z.object({ note: z.string().max(1000).nullish() });
/** Add / edit a rider. Same rules as the app's Profile Setup (UpdateRiderProfileRequest in openapi.yaml). */
const CreateRiderBody = z.object({
  phoneNumber: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be in international format, e.g. +15551234567'),
  displayName: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9._]+$/, 'Letters, numbers, dots and underscores only'),
  homeCity: z.string().trim().min(2).max(60),
  rideStyle: z.enum(['party_tech', 'networking', 'deep_talks', 'just_chilling']),
  incognitoDropoff: z.boolean(),
});
export type CreateRiderInput = z.infer<typeof CreateRiderBody>;

const RiderOverridesBody = z.object({ desktop: z.boolean().optional(), system: z.boolean().optional() });

const SettingsBody = z.object({ values: z.record(z.string(), z.union([z.number(), z.boolean(), z.null()])) });

/**
 * Admin panel API (artifacts/admin-web). Not part of the rider OpenAPI contract: admins sign in
 * with email + password and must be listed in Firestore `admins/{uid}`.
 */
@Controller('v1/admin')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly categories: RoomCategoriesService,
  ) {}

  /** Room categories plus the icon and colour choices the app supports. */
  @Get('settings/room-categories')
  roomCategories() {
    return { ...this.categories.catalog(), icons: CATEGORY_ICONS, colors: CATEGORY_COLORS };
  }

  @Put('settings/room-categories')
  async updateRoomCategories(@Req() req: AdminRequest, @Body() body: unknown) {
    await this.categories.save(body, req.user!.email ?? null);
    return this.roomCategories();
  }

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

  /** Add a rider by phone number; they sign in on the app with that number and land on this profile. */
  @Post('users')
  createUser(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.admin.createUser(parseBody(CreateRiderBody, body), req.user!.email ?? null);
  }

  @Get('users/:uid')
  user(@Param('uid') uid: string) {
    return this.admin.getUser(uid);
  }

  /** Edit a rider's profile (same fields as Add rider). Changing the phone changes how they sign in. */
  @Put('users/:uid')
  updateUser(@Req() req: AdminRequest, @Param('uid') uid: string, @Body() body: unknown) {
    return this.admin.updateUser(uid, parseBody(CreateRiderBody, body), req.user!.email ?? null);
  }

  /** "Kill session": end the rider's current ride and take them out of any room. Not a suspension. */
  @Post('users/:uid/end-ride')
  @HttpCode(200)
  endRide(@Req() req: AdminRequest, @Param('uid') uid: string) {
    return this.admin.endRide(uid, req.user!.email ?? null);
  }

  /** "Block device": block every phone this rider has used. */
  @Post('users/:uid/block-devices')
  @HttpCode(200)
  blockRiderDevices(@Req() req: AdminRequest, @Param('uid') uid: string, @Body() body: unknown) {
    return this.admin.blockRiderDevices(uid, parseBody(SuspendBody, body ?? {}).reason ?? null, req.user!.email ?? null);
  }

  @Get('devices/blocked')
  blockedDevices() {
    return this.admin.listBlockedDevices();
  }

  @Post('devices/:key/block')
  @HttpCode(200)
  blockDevice(@Req() req: AdminRequest, @Param('key') key: string, @Body() body: unknown) {
    return this.admin.setDeviceBlocked(key, true, parseBody(SuspendBody, body ?? {}).reason ?? null, req.user!.email ?? null);
  }

  @Post('devices/:key/unblock')
  @HttpCode(200)
  unblockDevice(@Req() req: AdminRequest, @Param('key') key: string) {
    return this.admin.setDeviceBlocked(key, false, null, req.user!.email ?? null);
  }

  /** Permanently delete the rider's account and profile. Reports and safety alerts are kept. */
  @Delete('users/:uid')
  deleteUser(@Req() req: AdminRequest, @Param('uid') uid: string) {
    return this.admin.deleteUser(uid, req.user!.email ?? null);
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

  @Get('settings/test-overrides')
  testOverrides() {
    return this.admin.getTestOverrides();
  }

  @Put('settings/test-overrides')
  saveTestOverrides(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.admin.saveTestOverrides(body, req.user!.email ?? null);
  }

  @Put('users/:uid/test-overrides')
  riderTestOverrides(@Req() req: AdminRequest, @Param('uid') uid: string, @Body() body: unknown) {
    return this.admin.setRiderTestOverrides(uid, parseBody(RiderOverridesBody, body), req.user!.email ?? null);
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
