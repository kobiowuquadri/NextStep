import { Body, Controller, Delete, Get, HttpCode, Inject, Patch } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { Preferences, SYNC_ENTITIES, z } from '@nextstep/contracts';
import { ApiError, CurrentUser, parse } from '../common/http.js';
import { PrismaService } from '../prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { SyncService } from '../sync/sync.service.js';
import { MODELS, toWire } from '../sync/registry.js';
import { authLimit } from '../throttle.js';

const DeleteAccount = z.object({ password: z.string().min(1).max(128), confirm: z.literal('DELETE') });
const PreferencesPatch = Preferences.omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true, rev: true }).partial();

@Controller('v1/me')
export class AccountController {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SyncService) private readonly sync: SyncService,
  ) {}

  @Get()
  async me(@CurrentUser() user: { id: string }) {
    const [profile, prefs] = await Promise.all([this.auth.me(user.id), this.db.userPreferences.findUnique({ where: { userId: user.id } })]);
    return { user: profile, preferences: prefs ? toWire('preferences', prefs as never) : null };
  }

  @Patch('preferences')
  async updatePreferences(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const patch = parse(PreferencesPatch, body);
    const current = await this.db.userPreferences.findUniqueOrThrow({ where: { userId: user.id } });
    const [result] = (await this.sync.push(user.id, 'rest-api', [
      { opId: randomUUID(), entity: 'preferences', entityId: user.id, kind: 'upsert', baseRev: current.rev, changedFields: Object.keys(patch), data: patch, clientTime: new Date().toISOString() },
    ])).results;
    if (result?.status === 'rejected') throw new ApiError(400, 'VALIDATION_FAILED', 'Preferences could not be saved.', result.record);
    const updated = await this.db.userPreferences.findUniqueOrThrow({ where: { userId: user.id } });
    return toWire('preferences', updated as never);
  }

  /** Everything we hold about the account, as JSON. */
  @Get('export')
  @Throttle(authLimit(5))
  async export(@CurrentUser() user: { id: string }) {
    const profile = await this.auth.me(user.id);
    const data: Record<string, unknown[]> = {};
    for (const entity of SYNC_ENTITIES) {
      const rows = await (this.db as unknown as Record<string, any>)[MODELS[entity].delegate].findMany({ where: { userId: user.id, deletedAt: null } });
      data[entity] = (rows as Record<string, unknown>[]).map((r) => toWire(entity, r));
    }
    return {
      exportedAt: new Date().toISOString(),
      format: 'nextstep-export-v1',
      note: 'Passwords and session tokens are never exported (we only store one-way hashes).',
      user: profile,
      data,
    };
  }

  /** Permanently delete the account and all its data (cascades through every table). */
  @Delete()
  @HttpCode(204)
  @Throttle(authLimit(5))
  async remove(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const { password } = parse(DeleteAccount, body);
    if (!(await this.auth.verifyPassword(user.id, password))) throw new ApiError(403, 'FORBIDDEN', 'Password is incorrect.');
    await this.db.user.delete({ where: { id: user.id } });
  }
}
