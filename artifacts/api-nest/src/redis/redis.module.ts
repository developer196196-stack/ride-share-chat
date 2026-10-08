import { Global, Logger, Module, type OnApplicationShutdown, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { loadAppConfig } from '../config/configuration';

export const REDIS = 'REDIS';

/** Prefix for every key this API writes, so the database can be shared safely. */
export const REDIS_PREFIX = 'rsc:';

const logger = new Logger('Redis');

/** Upstash (and most managed Redis) only accepts TLS; upgrade a plain redis:// URL for those hosts. */
export function normalizeRedisUrl(raw: string): { url: string; host: string; upgradedToTls: boolean } {
  try {
    const parsed = new URL(raw);
    const managedTlsHost = /\.upstash\.io$/i.test(parsed.hostname);
    if (parsed.protocol === 'redis:' && managedTlsHost) {
      parsed.protocol = 'rediss:';
      return { url: parsed.toString(), host: parsed.hostname, upgradedToTls: true };
    }
    return { url: raw, host: parsed.hostname, upgradedToTls: false };
  } catch {
    return { url: raw, host: 'unparseable-url', upgradedToTls: false };
  }
}

function describeError(error: Error & { code?: string }): string {
  return [error.code, error.message].filter(Boolean).join(' ') || error.name;
}

function createRedis(): Redis | null {
  const { REDIS_URL } = loadAppConfig();
  if (!REDIS_URL) {
    logger.warn('REDIS_URL is not set — validation, rooms and chat are disabled.');
    return null;
  }
  if (/^https?:\/\//i.test(REDIS_URL)) {
    logger.error(
      'REDIS_URL looks like an Upstash REST URL (https://…). Use the Redis connection string that starts with rediss:// instead.',
    );
    return null;
  }
  const { url, host, upgradedToTls } = normalizeRedisUrl(REDIS_URL);
  if (upgradedToTls) logger.log(`Using TLS (rediss://) for ${host}`);

  const client = new Redis(url, {
    keyPrefix: REDIS_PREFIX,
    maxRetriesPerRequest: 3,
    enableAutoPipelining: true,
  });
  let lastError = '';
  client.on('error', (error: Error & { code?: string }) => {
    const message = describeError(error);
    // Avoid flooding the log with the same reconnect error.
    if (message !== lastError) logger.error(`Redis error (${host}): ${message}`);
    lastError = message;
  });
  client.on('ready', () => {
    lastError = '';
    logger.log(`Redis connected (${host})`);
  });
  return client;
}

@Global()
@Module({
  providers: [{ provide: REDIS, useFactory: createRedis }],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }
}
