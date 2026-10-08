import { ServiceUnavailableException } from '@nestjs/common';
import type Redis from 'ioredis';
import type { ErrorResponseBody } from './error-response';

export function unavailable(code: string, message: string): never {
  const body: ErrorResponseBody = { code, message };
  throw new ServiceUnavailableException(body);
}

/** Returns the Redis client or throws a 503 explaining what is missing. */
export function requireRedis(redis: Redis | null): Redis {
  if (!redis) {
    unavailable('REDIS_UNAVAILABLE', 'Realtime state is not configured on this server (REDIS_URL).');
  }
  return redis;
}
