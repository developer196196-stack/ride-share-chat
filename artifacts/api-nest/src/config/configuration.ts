import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5001),
  CORS_ORIGINS: z.string().optional(),
  /** Public origin used in share links, e.g. https://api.ridesharechats.com. Falls back to the request host. */
  PUBLIC_BASE_URL: optionalString,
  REDIS_URL: optionalString,
  GOOGLE_ROADS_API_KEY: optionalString,
  LIVEKIT_URL: optionalString,
  LIVEKIT_API_KEY: optionalString,
  LIVEKIT_API_SECRET: optionalString,
  /** Accept `simulated: true` telemetry (dev builds / emulators). Never enable in production. */
  VALIDATION_ALLOW_SIMULATED: optionalString,
});

export type AppConfig = z.infer<typeof envSchema> & {
  corsOrigins: string[];
  livekitConfigured: boolean;
  allowSimulatedTelemetry: boolean;
};

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const corsOrigins =
    parsed.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  const simulatedFlag = parsed.VALIDATION_ALLOW_SIMULATED?.toLowerCase();
  return {
    ...parsed,
    corsOrigins,
    livekitConfigured: Boolean(parsed.LIVEKIT_URL && parsed.LIVEKIT_API_KEY && parsed.LIVEKIT_API_SECRET),
    // Simulated rides are a development aid only — production always rejects them.
    allowSimulatedTelemetry:
      parsed.NODE_ENV !== 'production' && (simulatedFlag === 'true' || simulatedFlag === '1'),
  };
}

export function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  return loadAppConfig(env).PORT;
}
