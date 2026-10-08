import { Body, Controller, Get, Header, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { DecodedIdToken } from '@workspace/firebase';
import { CreateReportBody, CreateSafetyAlertBody, CreateShareLinkBody } from '@workspace/api-zod';
import { parseBody } from '../common/zod-parse';
import { resolvePublicBaseUrl } from '../common/public-base-url';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ReportsService } from './reports.service';
import { SafetyService } from './safety.service';
import { renderSharePage } from './share-page';

type AuthedRequest = {
  user?: DecodedIdToken;
  headers: Record<string, string | string[] | undefined>;
  protocol?: string;
};

@Controller('v1')
export class SafetyController {
  constructor(
    private readonly safety: SafetyService,
    private readonly reports: ReportsService,
  ) {}

  @Post('safety/share-links')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(200)
  shareLink(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { ttlMinutes } = parseBody(CreateShareLinkBody, body ?? {});
    return this.safety.createShareLink(req.user!.uid, resolvePublicBaseUrl(req.headers, req.protocol), ttlMinutes);
  }

  @Post('safety/alerts')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(200)
  alert(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = parseBody(CreateSafetyAlertBody, body);
    return this.safety.createAlert(
      req.user!.uid,
      parsed.kind,
      parsed.location ?? null,
      resolvePublicBaseUrl(req.headers, req.protocol),
    );
  }

  /** Public JSON for the share page — no auth, token is the capability. */
  @Get('public/share/:token')
  publicShare(@Param('token') token: string) {
    return this.safety.getPublic(token);
  }

  @Post('reports')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(200)
  report(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.reports.create(req.user!.uid, parseBody(CreateReportBody, body));
  }
}

/** Public HTML status page at /api/share/:token. */
@Controller('share')
export class SharePageController {
  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  page(@Param('token') token: string): string {
    return renderSharePage(token);
  }
}
