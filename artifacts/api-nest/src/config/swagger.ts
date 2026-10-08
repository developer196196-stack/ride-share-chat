import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import type { OpenAPIObject } from '@nestjs/swagger';
import type { AppConfig } from './configuration';

export function shouldEnableSwagger(config: AppConfig): boolean {
  const explicit = process.env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return config.NODE_ENV !== 'production';
}

export function loadOpenApiDocument(): OpenAPIObject {
  const candidates = [
    join(__dirname, 'openapi', 'openapi.yaml'),
    join(__dirname, '..', 'openapi', 'openapi.yaml'),
    join(process.cwd(), 'dist', 'openapi', 'openapi.yaml'),
    join(process.cwd(), 'openapi', 'openapi.yaml'),
    join(process.cwd(), '..', '..', 'lib', 'api-spec', 'openapi.yaml'),
  ];

  const specPath = candidates.find((path) => existsSync(path));
  if (!specPath) {
    throw new Error(
      `OpenAPI spec not found. Expected one of: ${candidates.join(', ')}`,
    );
  }

  return loadYaml(readFileSync(specPath, 'utf8')) as OpenAPIObject;
}
