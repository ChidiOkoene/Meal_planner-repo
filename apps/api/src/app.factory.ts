import { randomUUID } from 'node:crypto';
import { type DynamicModule } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LOG_REDACT_PATHS } from '@dyjext/shared';
import { type FastifyServerOptions, type RawRequestDefaultExpression } from 'fastify';
import { AppModule } from './app.module.js';
import { PinoNestLogger } from './common/pino-nest-logger.js';
import { type AppConfig } from './config/config.js';

const REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Build the configured application without starting to listen.
 * Used by `main.ts` and by tests (which call `app.inject()` instead of opening a port).
 */
export async function createApp(
  config: AppConfig,
  options: { extraModules?: DynamicModule['imports'] } = {},
): Promise<NestFastifyApplication> {
  const logger: FastifyServerOptions['logger'] = {
    level: config.LOG_LEVEL,
    redact: { paths: LOG_REDACT_PATHS, censor: '[redacted]' },
    ...(config.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
      : {}),
  };

  const adapter = new FastifyAdapter({
    logger,
    trustProxy: true,
    bodyLimit: 1_048_576, // 1 MiB; larger uploads go straight to object storage.
    // Reuse a caller's request id (e.g. from the load balancer) when it looks sane.
    genReqId: (request: RawRequestDefaultExpression) => {
      const header = request.headers['x-request-id'];
      return typeof header === 'string' && REQUEST_ID.test(header) ? header : randomUUID();
    },
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(config, options.extraModules),
    adapter,
    { bufferLogs: true },
  );

  const fastify = app.getHttpAdapter().getInstance();
  app.useLogger(new PinoNestLogger(fastify.log));
  fastify.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  app.setGlobalPrefix('v1', { exclude: ['healthz', 'readyz'] });
  app.enableCors({ origin: config.CORS_ORIGINS, credentials: true });
  app.enableShutdownHooks();

  if (config.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Dyjext Care API')
        .setDescription('Internal API for the web app, staff console and webhooks.')
        .setVersion(config.APP_VERSION)
        .build(),
    );
    SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json' });
  }

  return app;
}
