import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { Id, PushRequest, ResolveConflictRequest, z } from '@nextstep/contracts';
import { CurrentUser, notFound, parse } from '../common/http.js';
import { SyncService } from './sync.service.js';

const PullQuery = z.object({ cursor: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(1000).default(500) });

@Controller('v1/sync')
export class SyncController {
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}

  /** Upload queued operations. Safe to retry: every op is idempotent by opId. */
  @Post('push')
  @HttpCode(200)
  push(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const req = parse(PushRequest, body);
    return this.sync.push(user.id, req.deviceId, req.ops);
  }

  /** Download changes after a server-issued cursor. */
  @Get('pull')
  pull(@CurrentUser() user: { id: string }, @Query() query: unknown) {
    const q = parse(PullQuery, query);
    return this.sync.pull(user.id, q.cursor, q.limit);
  }

  @Post('conflicts/:id/resolve')
  @HttpCode(200)
  async resolve(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: unknown) {
    parse(Id, id);
    const { choice } = parse(ResolveConflictRequest, body);
    try {
      return await this.sync.resolveConflict(user.id, id, choice);
    } catch (e) {
      if ((e as { code?: string }).code === 'NOT_FOUND') throw notFound('Conflict');
      throw e;
    }
  }
}
