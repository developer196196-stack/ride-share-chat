import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadAppConfig, resolvePort } from './config/configuration';
import { loadOpenApiDocument, shouldEnableSwagger } from './config/swagger';

async function bootstrap() {
  const config = loadAppConfig();
  const app = await NestFactory.create(AppModule, {
    logger: config.NODE_ENV === 'development' ? ['log', 'error', 'warn', 'debug'] : ['log', 'error', 'warn'],
  });

  app.setGlobalPrefix('api');
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  if (shouldEnableSwagger(config)) {
    const document = loadOpenApiDocument();
    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: true,
      jsonDocumentUrl: 'openapi.json',
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  if (config.corsOrigins.length > 0) {
    app.enableCors({ origin: config.corsOrigins, credentials: true });
  } else if (config.NODE_ENV === 'development') {
    app.enableCors({ origin: true, credentials: true });
  }

  const port = resolvePort();
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`NestJS API listening on http://0.0.0.0:${port} (prefix /api)`);
  if (shouldEnableSwagger(config)) {
    logger.log(`Swagger UI: http://0.0.0.0:${port}/api/docs`);
  }
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start NestJS API', error);
  process.exit(1);
});
