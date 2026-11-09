import 'reflect-metadata';
import { ConsoleLogger, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import type { NextFunction, Request, Response } from 'express';
import { loadConfig } from './config.js';
import { AppModule } from './app.module.js';
import { requestIdMiddleware, type AuthedRequest } from './common/http.js';
import { buildOpenApi, DOCS_HTML } from './openapi.js';

export async function createApp(opts: { logger?: boolean } = {}): Promise<INestApplication> {
  const config = loadConfig();
  const logger = new ConsoleLogger({ json: config.NODE_ENV === 'production', logLevels: opts.logger === false ? ['error'] : ['error', 'warn', 'log'] });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger, bodyParser: false });

  const express = app.getHttpAdapter().getInstance();
  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.useBodyParser('json', { limit: '1mb' });
  // gzip responses: sync pulls are mostly repetitive JSON and shrink several-fold on metered data.
  app.use(compression({ threshold: 1024 }));
  app.use((req: Request, res: Response, next: NextFunction) => requestIdMiddleware(req as AuthedRequest, res, next));

  // API docs (served before helmet so the docs page may load its pinned CDN bundle).
  const spec = buildOpenApi();
  express.get('/docs/openapi.json', (_req: Request, res: Response) => res.json(spec));
  express.get('/docs', (_req: Request, res: Response) => res.type('html').send(DOCS_HTML));

  app.use(helmet());
  const origins = config.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'If-Match', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });
  app.enableShutdownHooks();
  return app;
}
