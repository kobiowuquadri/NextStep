import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  classifyConcurrentChange,
  ENTITY_SPECS,
  META_FIELDS,
  SYNC_ENTITIES,
  type OpResult,
  type PullChange,
  type PullResponse,
  type PushResponse,
  type SyncConflict,
  type SyncEntity,
  type SyncOp,
} from '@nextstep/contracts';
import type { AppState, Mutation } from '@nextstep/engine';
import { PrismaService, type Tx } from '../prisma.service.js';
import { MODELS, toDb, toWire } from './registry.js';
import { XpVerifier } from './xp-verifier.js';

type Row = Record<string, unknown> & { id: string; userId: string; rev: number; deletedAt: Date | null; fieldRevs?: unknown };

const ENTITY_RANK: Record<SyncEntity, number> = Object.fromEntries(
  (['preferences', 'semester', 'course', 'goal', 'task', 'subtask', 'availability', 'commitment', 'dayOverride', 'planRevision', 'recoveryProposal', 'session', 'focusLog', 'reflection', 'goalCheckin', 'resourceProgress', 'gamificationEvent', 'userAchievement'] as SyncEntity[]).map((e, i) => [e, i]),
) as Record<SyncEntity, number>;
const IMMUTABLE: ReadonlySet<SyncEntity> = new Set(['gamificationEvent', 'userAchievement']);
/** Clients may report createdAt from their clock, but never in the future. */
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

class BatchAbort extends Error {
  constructor(public readonly results: OpResult[]) {
    super('batch aborted');
  }
}

@Injectable()
export class SyncService {
  private readonly log = new Logger('Sync');

  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(XpVerifier) private readonly xp: XpVerifier,
  ) {}

  private delegate(tx: Tx, entity: SyncEntity) {
    return (tx as unknown as Record<string, any>)[MODELS[entity].delegate];
  }

  /** Serialise all writes for one user so revisions are allocated in commit order. */
  private async lock(tx: Tx, userId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
  }

  private async nextRev(tx: Tx, userId: string): Promise<number> {
    const u = await tx.user.update({ where: { id: userId }, data: { syncRev: { increment: 1 } }, select: { syncRev: true } });
    return u.syncRev;
  }

  /** Apply a push. Ops sharing a batchId commit together or not at all. */
  async push(userId: string, deviceId: string, ops: SyncOp[]): Promise<PushResponse> {
    const groups: SyncOp[][] = [];
    for (const op of ops) {
      const last = groups[groups.length - 1];
      if (last && last[0]!.batchId === op.batchId) last.push(op);
      else groups.push([op]);
    }
    const results: OpResult[] = [];
    for (const group of groups) results.push(...(await this.applyGroup(userId, deviceId, group)));
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { syncRev: true } });
    return { results, cursor: user.syncRev, serverTime: new Date().toISOString() };
  }

  private async applyGroup(userId: string, deviceId: string, group: SyncOp[]): Promise<OpResult[]> {
    const isBatch = !!group[0]!.batchId;
    try {
      return await this.db.$transaction(
        async (tx) => {
          await this.lock(tx, userId);
          return this.applyOpsInTx(tx, userId, deviceId, group, isBatch);
        },
        { timeout: 30_000, maxWait: 15_000 },
      );
    } catch (e) {
      if (e instanceof BatchAbort) {
        // Record the rejection outside the rolled-back transaction so retries are idempotent.
        await this.db.$transaction(async (tx) => {
          await this.lock(tx, userId);
          for (let i = 0; i < group.length; i++) await this.remember(tx, userId, deviceId, group[i]!, e.results[i]!);
        });
        return e.results;
      }
      if (isBatch || group.length === 1) {
        this.log.error(`push failed for ${group.length} op(s): ${(e as Error).message}`);
        return group.map((op) => ({ opId: op.opId, status: 'rejected' as const, reason: 'INTERNAL' }));
      }
      // A loose group failed unexpectedly: retry op by op so one bad op can't block the rest.
      const out: OpResult[] = [];
      for (const op of group) out.push(...(await this.applyGroup(userId, deviceId, [op])));
      return out;
    }
  }

  private async remember(tx: Tx, userId: string, deviceId: string, op: SyncOp, result: OpResult) {
    await tx.syncOperation.upsert({
      where: { opId: op.opId },
      create: { opId: op.opId, userId, deviceId, entity: op.entity, entityId: op.entityId, status: result.status, result: result as object },
      update: {},
    });
  }

  private async applyOpsInTx(tx: Tx, userId: string, deviceId: string, ops: SyncOp[], isBatch: boolean): Promise<OpResult[]> {
    // Idempotency: replayed operations return their stored result.
    const seen = await tx.syncOperation.findMany({ where: { opId: { in: ops.map((o) => o.opId) } } });
    const seenById = new Map(seen.map((s) => [s.opId, s]));
    if (seen.some((s) => s.userId !== userId)) return ops.map((op) => ({ opId: op.opId, status: 'rejected' as const, reason: 'FORBIDDEN' }));
    if (isBatch && seen.length === ops.length) return ops.map((op) => this.replay(seenById.get(op.opId)!.result as OpResult));

    // A plan batch built on an old plan revision must not overwrite a newer plan.
    if (isBatch) {
      const planOp = ops.find((o) => o.entity === 'planRevision' && o.kind === 'upsert' && o.basePlanRevision !== undefined && !seenById.has(o.opId));
      if (planOp) {
        const latest = await tx.planRevision.aggregate({ where: { userId, deletedAt: null }, _max: { number: true } });
        const current = latest._max.number ?? 0;
        if (current > planOp.basePlanRevision!) {
          const rev = await this.nextRev(tx, userId);
          const conflict = await tx.syncConflict.create({
            data: {
              id: randomUUID(),
              userId,
              entity: 'planRevision',
              entityId: planOp.entityId,
              fields: ['plan'],
              serverValues: { currentRevision: current },
              clientValues: { basePlanRevision: planOp.basePlanRevision, summary: (planOp.data?.summary as string) ?? null, sessions: ops.filter((o) => o.entity === 'session' && o.kind === 'upsert').map((o) => o.data ?? {}) } as object,
              rev,
            },
          });
          const results = ops.map((op) => ({ opId: op.opId, status: 'conflict' as const, reason: 'STALE_PLAN', conflictId: conflict.id }));
          for (let i = 0; i < ops.length; i++) await this.remember(tx, userId, deviceId, ops[i]!, results[i]!);
          return results;
        }
      }
    }

    // Apply in dependency order (parents before children) so a batch never fails on its own ordering;
    // results are still returned in request order.
    const ordered = isBatch ? [...ops].sort((x, y) => (x.kind === y.kind ? ENTITY_RANK[x.entity] - ENTITY_RANK[y.entity] : x.kind === 'upsert' ? -1 : 1)) : ops;
    const byOp = new Map<string, OpResult>();
    for (const op of ordered) {
      const prior = seenById.get(op.opId);
      if (prior) {
        byOp.set(op.opId, this.replay(prior.result as OpResult));
        continue;
      }
      const result = await this.applyOne(tx, userId, op);
      byOp.set(op.opId, result);
      if (isBatch && result.status === 'rejected') {
        throw new BatchAbort(
          ops.map((o) => (o.opId === op.opId ? result : { opId: o.opId, status: 'rejected' as const, reason: `BATCH_REJECTED:${result.reason}` })),
        );
      }
      await this.remember(tx, userId, deviceId, op, result);
    }
    return ops.map((op) => byOp.get(op.opId)!);
  }

  private replay(stored: OpResult): OpResult {
    return stored.status === 'applied' || stored.status === 'merged' ? { ...stored, status: 'duplicate' } : stored;
  }

  private rejected(op: SyncOp, reason: string, record?: Record<string, unknown>): OpResult {
    return { opId: op.opId, status: 'rejected', reason, ...(record ? { record } : {}) };
  }

  private async applyOne(tx: Tx, userId: string, op: SyncOp): Promise<OpResult> {
    const spec = ENTITY_SPECS[op.entity];
    const delegate = this.delegate(tx, op.entity);
    const existing = (await delegate.findUnique({ where: { id: op.entityId } })) as Row | null;
    if (existing && existing.userId !== userId) return this.rejected(op, 'NOT_FOUND');
    const marker = await tx.deletionMarker.findUnique({ where: { userId_entity_entityId: { userId, entity: op.entity, entityId: op.entityId } } });
    const now = new Date();

    if (op.kind === 'delete') {
      if (IMMUTABLE.has(op.entity)) return this.rejected(op, 'IMMUTABLE');
      if (existing?.deletedAt || (!existing && marker)) return { opId: op.opId, status: 'duplicate', rev: existing?.rev ?? marker!.rev };
      const rev = await this.nextRev(tx, userId);
      if (existing) await delegate.update({ where: { id: op.entityId }, data: { deletedAt: now, updatedAt: now, rev } });
      await tx.deletionMarker.upsert({
        where: { userId_entity_entityId: { userId, entity: op.entity, entityId: op.entityId } },
        create: { id: randomUUID(), userId, entity: op.entity, entityId: op.entityId, rev, deletedAt: now },
        update: { rev, deletedAt: now },
      });
      return { opId: op.opId, status: 'applied', rev };
    }

    // Upsert. A deleted record is never brought back by a stale or replayed update.
    if (marker || existing?.deletedAt) {
      return this.rejected(op, 'RECORD_DELETED', existing ? toWire(op.entity, existing) : { id: op.entityId, deletedAt: marker!.deletedAt.toISOString() });
    }
    const raw = Object.fromEntries(Object.entries(op.data ?? {}).filter(([k]) => !(META_FIELDS as readonly string[]).includes(k) || k === 'createdAt'));
    if (op.entity === 'preferences' && op.entityId !== userId) return this.rejected(op, 'PREFERENCES_ID_MUST_EQUAL_USER_ID');

    if (!existing) {
      const clientCreated = typeof raw.createdAt === 'string' ? Date.parse(raw.createdAt) : NaN;
      const createdAt = Number.isFinite(clientCreated) && clientCreated <= now.getTime() + MAX_CLOCK_SKEW_MS ? new Date(clientCreated) : now;
      // XP is always computed by the server; whatever the client claimed is ignored.
      const candidate = { ...raw, ...(op.entity === 'gamificationEvent' ? { xp: 0 } : {}), id: op.entityId, createdAt: createdAt.toISOString(), updatedAt: now.toISOString(), deletedAt: null };
      const parsed = spec.schema.safeParse(candidate);
      if (!parsed.success) return { ...this.rejected(op, 'VALIDATION_FAILED'), record: { issues: parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message })) } };
      const data = parsed.data as Record<string, unknown>;
      const parentProblem = await this.checkParents(tx, userId, op.entity, data);
      if (parentProblem) return this.rejected(op, parentProblem);

      let wireOverride: Record<string, unknown> | null = null;
      if (op.entity === 'gamificationEvent') {
        const verdict = await this.xp.verifyEvent(tx, userId, data);
        if (verdict.kind === 'duplicate') return { opId: op.opId, status: 'duplicate', rev: verdict.existing.rev, record: verdict.existing };
        if (verdict.kind === 'invalid') return this.rejected(op, `XP_NOT_VERIFIED:${verdict.reason}`);
        data.xp = verdict.xp;
        data.dedupeKey = verdict.dedupeKey;
        wireOverride = {};
      }
      if (op.entity === 'userAchievement') {
        const dup = await tx.userAchievement.findUnique({ where: { userId_achievementId: { userId, achievementId: data.achievementId as string } } });
        if (dup) return { opId: op.opId, status: 'duplicate', rev: dup.rev, record: toWire('userAchievement', dup as unknown as Row) };
        if (!(await this.xp.verifyAchievement(tx, userId, data.achievementId as string))) return this.rejected(op, 'ACHIEVEMENT_NOT_EARNED');
      }
      if (op.entity === 'planRevision') {
        const taken = await tx.planRevision.findUnique({ where: { userId_number: { userId, number: data.number as number } } });
        if (taken) return { opId: op.opId, status: 'conflict', reason: 'STALE_PLAN', record: toWire('planRevision', taken as unknown as Row) };
      }
      if (op.entity === 'resourceProgress') {
        const other = await tx.resourceProgress.findUnique({ where: { userId_resourceId: { userId, resourceId: data.resourceId as string } } });
        if (other) return this.rejected(op, 'DUPLICATE_RESOURCE_PROGRESS', toWire('resourceProgress', other as unknown as Row));
      }

      const rev = await this.nextRev(tx, userId);
      const fieldRevs = Object.fromEntries(Object.keys(data).filter((k) => !(META_FIELDS as readonly string[]).includes(k)).map((k) => [k, rev]));
      const created = (await delegate.create({ data: { ...toDb(op.entity, data), id: op.entityId, userId, rev, fieldRevs, updatedAt: now } })) as Row;
      return { opId: op.opId, status: 'applied', rev, ...(wireOverride ? { record: toWire(op.entity, created) } : {}) };
    }

    // Update of an existing record.
    if (spec.appendOnly) return { opId: op.opId, status: 'duplicate', rev: existing.rev };
    const current = toWire(op.entity, existing);
    const changed = (op.changedFields ?? Object.keys(raw)).filter((f) => f in raw && !(META_FIELDS as readonly string[]).includes(f));
    const fieldRevs = (existing.fieldRevs ?? {}) as Record<string, number>;
    const baseRev = op.baseRev ?? 0;
    const serverChanged = Object.keys(fieldRevs).filter((f) => (fieldRevs[f] ?? 0) > baseRev);
    const { autoMerge, conflicting } = classifyConcurrentChange(op.entity, changed, serverChanged, raw, current);
    const effective = autoMerge.filter((f) => JSON.stringify(raw[f]) !== JSON.stringify(current[f]));
    if (effective.length === 0 && conflicting.length === 0) return { opId: op.opId, status: 'duplicate', rev: existing.rev };

    const merged = { ...current, ...Object.fromEntries(effective.map((f) => [f, raw[f]])), updatedAt: now.toISOString() };
    const parsed = spec.schema.safeParse(merged);
    if (!parsed.success) return { ...this.rejected(op, 'VALIDATION_FAILED'), record: { issues: parsed.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message })) } };
    const parentProblem = await this.checkParents(tx, userId, op.entity, parsed.data as Record<string, unknown>, effective);
    if (parentProblem) return this.rejected(op, parentProblem);

    const rev = await this.nextRev(tx, userId);
    const patch = toDb(op.entity, Object.fromEntries(effective.map((f) => [f, (parsed.data as Record<string, unknown>)[f]])));
    const updated = (await delegate.update({
      where: { id: op.entityId },
      data: { ...patch, updatedAt: now, rev, fieldRevs: { ...fieldRevs, ...Object.fromEntries(effective.map((f) => [f, rev])) } },
    })) as Row;

    if (conflicting.length > 0) {
      const conflictRev = await this.nextRev(tx, userId);
      const conflict = await tx.syncConflict.create({
        data: {
          id: randomUUID(),
          userId,
          entity: op.entity,
          entityId: op.entityId,
          fields: conflicting,
          serverValues: Object.fromEntries(conflicting.map((f) => [f, current[f] ?? null])) as object,
          clientValues: Object.fromEntries(conflicting.map((f) => [f, raw[f] ?? null])) as object,
          rev: conflictRev,
        },
      });
      return { opId: op.opId, status: 'conflict', rev, conflictId: conflict.id, reason: 'CONCURRENT_EDIT', record: toWire(op.entity, updated) };
    }
    return { opId: op.opId, status: serverChanged.length > 0 ? 'merged' : 'applied', rev, ...(serverChanged.length > 0 ? { record: toWire(op.entity, updated) } : {}) };
  }

  private async checkParents(tx: Tx, userId: string, entity: SyncEntity, data: Record<string, unknown>, onlyFields?: string[]): Promise<string | null> {
    for (const [field, parentEntity] of Object.entries(ENTITY_SPECS[entity].parents)) {
      if (onlyFields && !onlyFields.includes(field)) continue;
      const id = data[field];
      if (!id) continue;
      const parent = (await this.delegate(tx, parentEntity).findUnique({ where: { id } })) as Row | null;
      if (!parent || parent.userId !== userId) return `PARENT_NOT_FOUND:${field}`;
      if (parent.deletedAt && (entity === 'subtask' || entity === 'session' || entity === 'goalCheckin')) return `PARENT_DELETED:${field}`;
    }
    if (entity === 'resourceProgress') {
      const res = await tx.learningResource.findUnique({ where: { id: data.resourceId as string } });
      if (!res) return 'PARENT_NOT_FOUND:resourceId';
    }
    if (entity === 'userAchievement') {
      const a = await tx.achievement.findUnique({ where: { id: data.achievementId as string } });
      if (!a) return 'PARENT_NOT_FOUND:achievementId';
    }
    return null;
  }

  /** Changes after `cursor`, oldest first, in a consistent snapshot. */
  async pull(userId: string, cursor: number, limit = 500): Promise<PullResponse> {
    return this.db.$transaction(
      async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { syncRev: true } });
        const changes: PullChange[] = [];
        for (const entity of SYNC_ENTITIES) {
          const rows = (await this.delegate(tx, entity).findMany({ where: { userId, rev: { gt: cursor } }, orderBy: { rev: 'asc' }, take: limit + 1 })) as Row[];
          for (const r of rows) changes.push({ entity, id: r.id, rev: r.rev, deleted: !!r.deletedAt, record: toWire(entity, r) });
        }
        // Deletions of records the server never stored (deleted before first sync) still need to reach other devices.
        const markers = await tx.deletionMarker.findMany({ where: { userId, rev: { gt: cursor } }, orderBy: { rev: 'asc' }, take: limit + 1 });
        for (const m of markers) {
          if (!changes.some((c) => c.id === m.entityId)) changes.push({ entity: m.entity as SyncEntity, id: m.entityId, rev: m.rev, deleted: true, record: null });
        }
        const conflictRows = await tx.syncConflict.findMany({ where: { userId, rev: { gt: cursor } }, orderBy: { rev: 'asc' }, take: limit + 1 });
        type Item = { rev: number; change?: PullChange; conflict?: SyncConflict };
        const items: Item[] = [
          ...changes.map((c) => ({ rev: c.rev, change: c })),
          ...conflictRows.map((c) => ({
            rev: c.rev,
            conflict: {
              id: c.id,
              entity: c.entity as SyncEntity,
              entityId: c.entityId,
              fields: c.fields,
              serverValues: c.serverValues as Record<string, unknown>,
              clientValues: c.clientValues as Record<string, unknown>,
              status: c.status as 'open' | 'resolved',
              createdAt: c.createdAt.toISOString(),
              rev: c.rev,
            },
          })),
        ].sort((a, b) => a.rev - b.rev);
        const page = items.slice(0, limit);
        const hasMore = items.length > limit;
        const nextCursor = hasMore ? page[page.length - 1]!.rev : Math.max(cursor, user.syncRev);
        return {
          changes: page.filter((i) => i.change).map((i) => i.change!),
          conflicts: page.filter((i) => i.conflict).map((i) => i.conflict!),
          cursor: nextCursor,
          hasMore,
          serverTime: new Date().toISOString(),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 30_000 },
    );
  }

  /** Resolve a conflict by keeping the server value or re-applying the client's value. */
  async resolveConflict(userId: string, conflictId: string, choice: 'server' | 'client'): Promise<{ rev: number }> {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, userId);
      const c = await tx.syncConflict.findFirst({ where: { id: conflictId, userId } });
      if (!c) throw Object.assign(new Error('Conflict not found'), { code: 'NOT_FOUND' });
      if (c.status === 'resolved') return { rev: c.rev };
      if (choice === 'client' && c.entity !== 'planRevision') {
        const entity = c.entity as SyncEntity;
        const delegate = this.delegate(tx, entity);
        const row = (await delegate.findUnique({ where: { id: c.entityId } })) as Row | null;
        if (row && !row.deletedAt) {
          const values = c.clientValues as Record<string, unknown>;
          const merged = { ...toWire(entity, row), ...values };
          const parsed = ENTITY_SPECS[entity].schema.safeParse(merged);
          if (!parsed.success) throw Object.assign(new Error('Client values are no longer valid'), { code: 'VALIDATION_FAILED' });
          const rev = await this.nextRev(tx, userId);
          const fieldRevs = { ...((row.fieldRevs ?? {}) as Record<string, number>), ...Object.fromEntries(c.fields.map((f) => [f, rev])) };
          await delegate.update({ where: { id: c.entityId }, data: { ...toDb(entity, values), rev, fieldRevs, updatedAt: new Date() } });
        }
      }
      const rev = await this.nextRev(tx, userId);
      await tx.syncConflict.update({ where: { id: c.id }, data: { status: 'resolved', resolution: choice, resolvedAt: new Date(), rev } });
      return { rev };
    });
  }

  /** Load one user's full state (live records only) for server-side planning. */
  async loadState(userId: string): Promise<AppState> {
    const get = async (entity: SyncEntity) =>
      ((await (this.db as unknown as Record<string, any>)[MODELS[entity].delegate].findMany({ where: { userId, deletedAt: null } })) as Row[]).map((r) => toWire(entity, r));
    const prefs = await this.db.userPreferences.findUnique({ where: { userId } });
    if (!prefs) throw Object.assign(new Error('Preferences missing'), { code: 'NOT_FOUND' });
    const [semesters, courses, tasks, subtasks, availability, commitments, overrides, sessions, planRevisions, focusLogs, proposals, reflections, goals, goalCheckins, resourceProgress, events, achievements] =
      await Promise.all(
        (['semester', 'course', 'task', 'subtask', 'availability', 'commitment', 'dayOverride', 'session', 'planRevision', 'focusLog', 'recoveryProposal', 'reflection', 'goal', 'goalCheckin', 'resourceProgress', 'gamificationEvent', 'userAchievement'] as const).map(get),
      );
    return {
      userId,
      preferences: toWire('preferences', prefs as unknown as Row) as never,
      semesters, courses, tasks, subtasks, availability, commitments, overrides, sessions, planRevisions, focusLogs, proposals, reflections, goals, goalCheckins, resourceProgress, events, achievements,
    } as unknown as AppState;
  }

  /** Apply engine mutations produced on the server as one atomic batch. */
  async applyMutations(userId: string, mutations: Mutation[], basePlanRevision?: number): Promise<OpResult[]> {
    const batchId = randomUUID();
    const ops: SyncOp[] = mutations.map((m) => ({
      opId: randomUUID(),
      entity: m.entity,
      entityId: m.id,
      kind: m.kind,
      // Records loaded from the database carry their revision, so server-side edits never conflict with themselves.
      baseRev: m.isNew ? null : ((m.record.rev as number | undefined) ?? null),
      changedFields: m.changedFields,
      data: m.record,
      batchId,
      basePlanRevision: m.entity === 'planRevision' && m.isNew ? basePlanRevision : undefined,
      clientTime: new Date().toISOString(),
    }));
    if (ops.length === 0) return [];
    const res = await this.push(userId, 'server', ops);
    return res.results;
  }
}
