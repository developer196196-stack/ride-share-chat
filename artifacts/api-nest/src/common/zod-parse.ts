import { UnprocessableEntityException } from '@nestjs/common';
import type { ZodType } from 'zod';
import type { ErrorResponseBody } from './error-response';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    const body: ErrorResponseBody = {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details: { issues: result.error.issues },
    };
    throw new UnprocessableEntityException(body);
  }

  return result.data;
}

export function validationError(message: string, details?: Record<string, unknown>): never {
  const body: ErrorResponseBody = {
    code: 'VALIDATION_ERROR',
    message,
    details,
  };
  throw new UnprocessableEntityException(body);
}
