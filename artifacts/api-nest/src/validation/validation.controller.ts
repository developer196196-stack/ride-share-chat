import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { DecodedIdToken } from '@workspace/firebase';
import { SubmitTelemetryBody } from '@workspace/api-zod';
import { parseBody } from '../common/zod-parse';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ValidationService } from './validation.service';
import type { TelemetrySample } from './validation.types';

type AuthedRequest = { user?: DecodedIdToken };

@Controller('v1/validation')
@UseGuards(FirebaseAuthGuard)
export class ValidationController {
  constructor(private readonly validation: ValidationService) {}

  @Post('telemetry')
  @HttpCode(200)
  submit(@Req() req: AuthedRequest, @Body() body: unknown) {
    const sample = parseBody(SubmitTelemetryBody, body) as TelemetrySample;
    return this.validation.ingest(req.user!.uid, sample);
  }

  @Get('state')
  state(@Req() req: AuthedRequest) {
    return this.validation.getSnapshot(req.user!.uid);
  }

  @Post('reset')
  @HttpCode(200)
  reset(@Req() req: AuthedRequest) {
    return this.validation.reset(req.user!.uid);
  }
}
