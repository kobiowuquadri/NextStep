import { Controller, Get, Inject, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from './common/http.js';
import { PrismaService } from './prisma.service.js';
import { AiService } from './ai/ai.service.js';

const VERSION = process.env.npm_package_version ?? '1.0.0';

@Controller()
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AiService) private readonly ai: AiService,
  ) {}

  /** Liveness + database check for load balancers and uptime monitors. */
  @Public()
  @SkipThrottle()
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    let db = 'ok';
    try {
      await this.db.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
      res.status(503);
    }
    return { status: db === 'ok' ? 'ok' : 'degraded', db, aiConfigured: this.ai.configured, version: VERSION, time: new Date().toISOString() };
  }
}
