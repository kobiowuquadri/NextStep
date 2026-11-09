import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CONFIG, loadConfig } from './config.js';
import { PrismaService } from './prisma.service.js';
import { AccessLogInterceptor, ErrorFilter } from './common/http.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { MailerService } from './auth/mailer.service.js';
import { TokensService } from './auth/tokens.service.js';
import { AccountController } from './account/account.controller.js';
import { SyncController } from './sync/sync.controller.js';
import { SyncService } from './sync/sync.service.js';
import { XpVerifier } from './sync/xp-verifier.js';
import { CrudController } from './sync/crud.controller.js';
import { PlanningController } from './planning/planning.controller.js';
import { ResourcesController } from './resources/resources.controller.js';
import { AiController } from './ai/ai.controller.js';
import { AiService } from './ai/ai.service.js';
import { HealthController } from './health.controller.js';
import { ReferenceDataService } from './reference-data.js';

const config = loadConfig();

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: config.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITS ? 100_000 : config.RATE_LIMIT_PER_MINUTE }],
    }),
  ],
  // CrudController must stay last: its /v1/:collection routes would otherwise shadow specific routes.
  controllers: [HealthController, AuthController, AccountController, SyncController, PlanningController, ResourcesController, AiController, CrudController],
  providers: [
    { provide: CONFIG, useValue: config },
    PrismaService,
    TokensService,
    MailerService,
    AuthService,
    XpVerifier,
    SyncService,
    AiService,
    ReferenceDataService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
    { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
  ],
})
export class AppModule {}
