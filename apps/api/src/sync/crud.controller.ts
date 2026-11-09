import { randomUUID } from 'node:crypto';
import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { Id, PageQuery, SYNC_ENTITIES, type OpResult, type SyncEntity, type SyncOp } from '@nextstep/contracts';
import { ApiError, CurrentUser, notFound, parse } from '../common/http.js';
import { PrismaService } from '../prisma.service.js';
import { MODELS, toWire } from './registry.js';
import { SyncService } from './sync.service.js';

const BY_PATH = new Map(SYNC_ENTITIES.filter((e) => e !== 'preferences').map((e) => [MODELS[e].path, e]));

function entityFor(collection: string, write = false): SyncEntity {
  const entity = BY_PATH.get(collection);
  if (!entity) throw notFound('Collection');
  if (write && !MODELS[entity].writable) throw new ApiError(405, 'READ_ONLY', 'This collection changes through planning, recovery or progress endpoints.');
  return entity;
}

function raise(result: OpResult | undefined): void {
  if (!result) throw new ApiError(500, 'INTERNAL', 'No result');
  if (result.status === 'rejected') {
    const reason = result.reason ?? 'REJECTED';
    if (reason === 'NOT_FOUND' || reason === 'RECORD_DELETED') throw notFound();
    throw new ApiError(reason.startsWith('VALIDATION') || reason.startsWith('PARENT') ? 400 : 409, reason.split(':')[0]!, 'The change was not accepted.', result.record ?? { reason });
  }
}

/**
 * Generic REST CRUD over every synchronised collection, e.g. /v1/tasks,
 * /v1/courses/:id. Writes go through the same code path as sync, so
 * validation, ownership, revisions, tombstones and conflict rules are identical.
 */
@Controller('v1')
export class CrudController {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(SyncService) private readonly sync: SyncService,
  ) {}

  private delegate(entity: SyncEntity) {
    return (this.db as unknown as Record<string, any>)[MODELS[entity].delegate];
  }

  @Get(':collection')
  async list(@CurrentUser() user: { id: string }, @Param('collection') collection: string, @Query() query: unknown) {
    const entity = entityFor(collection);
    const q = parse(PageQuery, query);
    const after = q.cursor ? Number(q.cursor) : 0;
    if (!Number.isInteger(after) || after < 0) throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid cursor');
    const rows = (await this.delegate(entity).findMany({
      where: {
        userId: user.id,
        rev: { gt: after },
        ...(q.includeDeleted ? {} : { deletedAt: null }),
        ...(q.updatedSince ? { updatedAt: { gt: new Date(q.updatedSince) } } : {}),
      },
      orderBy: { rev: 'asc' },
      take: q.limit + 1,
    })) as Array<Record<string, unknown> & { rev: number }>;
    const page = rows.slice(0, q.limit);
    return { items: page.map((r) => toWire(entity, r)), nextCursor: rows.length > q.limit ? String(page[page.length - 1]!.rev) : null };
  }

  @Get(':collection/:id')
  async get(@CurrentUser() user: { id: string }, @Param('collection') collection: string, @Param('id') id: string) {
    const entity = entityFor(collection);
    parse(Id, id);
    const row = await this.delegate(entity).findFirst({ where: { id, userId: user.id, deletedAt: null } });
    if (!row) throw notFound();
    return toWire(entity, row);
  }

  private async write(userId: string, op: Omit<SyncOp, 'opId' | 'clientTime'>) {
    const res = await this.sync.push(userId, 'rest-api', [{ ...op, opId: randomUUID(), clientTime: new Date().toISOString() }]);
    const result = res.results[0];
    raise(result);
    return result!;
  }

  @Post(':collection')
  async create(@CurrentUser() user: { id: string }, @Param('collection') collection: string, @Body() body: unknown) {
    const entity = entityFor(collection, true);
    const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const id = typeof data.id === 'string' ? parse(Id, data.id) : randomUUID();
    const now = new Date().toISOString();
    await this.write(user.id, { entity, entityId: id, kind: 'upsert', baseRev: null, data: { ...data, id, createdAt: now, updatedAt: now } });
    return this.get(user, collection, id);
  }

  /** Partial update. Send `If-Match: <rev>` to get conflict detection on important fields. */
  @Patch(':collection/:id')
  async update(@CurrentUser() user: { id: string }, @Param('collection') collection: string, @Param('id') id: string, @Body() body: unknown, @Headers('if-match') ifMatch?: string) {
    const entity = entityFor(collection, true);
    parse(Id, id);
    const existing = await this.delegate(entity).findFirst({ where: { id, userId: user.id, deletedAt: null } });
    if (!existing) throw notFound();
    const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const baseRev = ifMatch && /^\d+$/.test(ifMatch.replace(/"/g, '')) ? Number(ifMatch.replace(/"/g, '')) : (existing.rev as number);
    const result = await this.write(user.id, { entity, entityId: id, kind: 'upsert', baseRev, changedFields: Object.keys(data), data });
    const record = await this.get(user, collection, id);
    return result.status === 'conflict' ? { ...record, _conflictId: result.conflictId } : record;
  }

  @Delete(':collection/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: { id: string }, @Param('collection') collection: string, @Param('id') id: string) {
    const entity = entityFor(collection, true);
    parse(Id, id);
    const existing = await this.delegate(entity).findFirst({ where: { id, userId: user.id } });
    if (!existing) throw notFound();
    await this.write(user.id, { entity, entityId: id, kind: 'delete', baseRev: existing.rev as number });
  }
}
