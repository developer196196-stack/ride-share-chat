import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { DecodedIdToken } from '@workspace/firebase';
import { CreateTrustedContactBody, UpdatePreferencesBody } from '@workspace/api-zod';
import { parseBody } from '../common/zod-parse';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ValidationService } from '../validation/validation.service';
import { PreferencesService } from './preferences.service';

type AuthedRequest = { user?: DecodedIdToken };

@Controller('v1/me')
@UseGuards(FirebaseAuthGuard)
export class PreferencesController {
  constructor(
    private readonly preferences: PreferencesService,
    private readonly validation: ValidationService,
  ) {}

  @Get('preferences')
  async get(@Req() req: AuthedRequest) {
    const uid = req.user!.uid;
    const hint = await this.validation.getLanguageHint(uid).catch(() => null);
    return this.preferences.get(uid, hint);
  }

  @Put('preferences')
  update(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.preferences.update(req.user!.uid, parseBody(UpdatePreferencesBody, body));
  }

  @Get('trusted-contacts')
  listContacts(@Req() req: AuthedRequest) {
    return this.preferences.listContacts(req.user!.uid);
  }

  @Post('trusted-contacts')
  @HttpCode(200)
  addContact(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.preferences.addContact(req.user!.uid, parseBody(CreateTrustedContactBody, body));
  }

  @Delete('trusted-contacts/:contactId')
  @HttpCode(204)
  async removeContact(@Req() req: AuthedRequest, @Param('contactId') contactId: string) {
    await this.preferences.removeContact(req.user!.uid, contactId);
  }
}
