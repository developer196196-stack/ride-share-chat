import { Controller, Get, Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { loadAppConfig } from '../config/configuration';
import { FIREBASE_CONFIGURED } from '../firebase/firebase.tokens';
import { REDIS } from '../redis/redis.module';

/** Must stay in sync with OpenAPI `HealthStatus`. */
@Controller('healthz')
export class HealthController {
  constructor(
    @Inject(FIREBASE_CONFIGURED) private readonly firebaseConfigured: boolean,
    @Inject(REDIS) private readonly redis: Redis | null,
  ) {}

  @Get()
  async getHealth(): Promise<{
    status: 'ok';
    firebaseConfigured: boolean;
    redisConfigured: boolean;
    livekitConfigured: boolean;
    roadsConfigured: boolean;
  }> {
    const config = loadAppConfig();
    let redisConfigured = false;
    if (this.redis) {
      redisConfigured = await this.redis
        .ping()
        .then((pong) => pong === 'PONG')
        .catch(() => false);
    }
    return {
      status: 'ok',
      firebaseConfigured: this.firebaseConfigured,
      redisConfigured,
      livekitConfigured: config.livekitConfigured,
      roadsConfigured: Boolean(config.GOOGLE_ROADS_API_KEY),
    };
  }
}
