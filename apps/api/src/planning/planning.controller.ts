import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { localDateKey, RecoveryInput, weekStartOfKey, z } from '@nextstep/contracts';
import {
  acceptRecovery,
  currentRevision,
  generatePlanAction,
  keepCurrentPlan,
  lastRecoveryAt,
  live,
  previewRecovery,
  toPlannerInput,
  weeklySummary,
  type ActionResult,
  type Ctx,
} from '@nextstep/engine';
import { ACHIEVEMENTS, questsFor, summariseProgress, unlockedCosmetics, type LedgerEntry } from '@nextstep/gamification';
import { analyzePlan, buildToday, generatePlan } from '@nextstep/scheduler';
import { ApiError, CurrentUser, parse } from '../common/http.js';
import { SyncService } from '../sync/sync.service.js';

const AcceptRecovery = z.object({ input: RecoveryInput, baseRevision: z.number().int().min(0), fingerprint: z.string().min(1).max(64) });

const ctx = (): Ctx => ({ now: Date.now(), newId: () => randomUUID() });

@Controller('v1')
export class PlanningController {
  constructor(@Inject(SyncService) private readonly sync: SyncService) {}

  private async commit(userId: string, r: ActionResult, basePlanRevision?: number) {
    const results = await this.sync.applyMutations(userId, r.mutations, basePlanRevision);
    const failed = results.find((x) => x.status === 'rejected' || x.status === 'conflict');
    if (failed) throw new ApiError(409, failed.reason?.includes('STALE_PLAN') ? 'STALE_PREVIEW' : 'CONFLICT', 'Your plan changed while this was being prepared. Please review it again.', { reason: failed.reason });
    return results;
  }

  /** Today's realistic actions, deadlines and the completed-for-today state. */
  @Get('today')
  async today(@CurrentUser() user: { id: string }) {
    const state = await this.sync.loadState(user.id);
    return buildToday(toPlannerInput(state, Date.now()), 3, lastRecoveryAt(state));
  }

  /** Dry run: the plan NextStep would make right now, with explanations and any shortfall. */
  @Post('planning/preview')
  @HttpCode(200)
  async preview(@CurrentUser() user: { id: string }) {
    const state = await this.sync.loadState(user.id);
    return { revision: currentRevision(state), plan: generatePlan(toPlannerInput(state, Date.now())), issues: analyzePlan(toPlannerInput(state, Date.now())) };
  }

  /** Generate and save a new automatic plan as the next plan revision. */
  @Post('planning/generate')
  @HttpCode(200)
  async generate(@CurrentUser() user: { id: string }) {
    const state = await this.sync.loadState(user.id);
    const base = currentRevision(state);
    const { result, plan } = generatePlanAction(state, ctx());
    await this.commit(user.id, result, base);
    return { revision: base + 1, plan, awards: result.awards.map((a) => a.entry), unlocked: result.unlocked.map((a) => a.id) };
  }

  /** Build a Recovery Mode proposal. Nothing is saved. */
  @Post('recovery/preview')
  @HttpCode(200)
  async recoveryPreview(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const input = parse(RecoveryInput, body);
    const state = await this.sync.loadState(user.id);
    return previewRecovery(state, input, ctx());
  }

  /**
   * Accept a proposal. The server rebuilds it from current data and refuses
   * (409 STALE_PREVIEW, with a fresh proposal) if anything changed since the
   * student reviewed it — it never applies a plan the student didn't see.
   */
  @Post('recovery/accept')
  @HttpCode(200)
  async recoveryAccept(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const { input, baseRevision, fingerprint } = parse(AcceptRecovery, body);
    const state = await this.sync.loadState(user.id);
    const proposal = previewRecovery(state, input, ctx());
    if (proposal.baseRevision !== baseRevision || proposal.fingerprint !== fingerprint) {
      throw new ApiError(409, 'STALE_PREVIEW', 'Your plan changed since you reviewed this. Here is an updated proposal.', { proposal });
    }
    const r = acceptRecovery(state, proposal, ctx());
    if ('error' in r) throw new ApiError(409, 'STALE_PREVIEW', 'Your plan changed since you reviewed this.', { reason: r.reason, proposal: previewRecovery(state, input, ctx()) });
    await this.commit(user.id, r, baseRevision);
    return { revision: baseRevision + 1, nextAction: proposal.nextAction, awards: r.awards.map((a) => a.entry), unlocked: r.unlocked.map((a) => a.id) };
  }

  @Post('recovery/keep')
  @HttpCode(200)
  async recoveryKeep(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    const input = parse(RecoveryInput, body);
    const state = await this.sync.loadState(user.id);
    await this.commit(user.id, keepCurrentPlan(state, previewRecovery(state, input, ctx()), ctx()));
    return { kept: true };
  }

  /** XP, level, steady weeks, quests, badges and unlocked cosmetics. */
  @Get('progress')
  async progress(@CurrentUser() user: { id: string }) {
    const state = await this.sync.loadState(user.id);
    const tz = state.preferences.timezone;
    const today = localDateKey(Date.now(), tz);
    const ledger = live(state.events) as LedgerEntry[];
    const summary = summariseProgress(ledger, today, state.preferences.weeklyActiveDaysGoal);
    const unlocked = new Set(live(state.achievements).map((a) => a.achievementId));
    return {
      ...summary,
      quests: questsFor(ledger, today, { hasActiveGoal: live(state.goals).some((g) => g.active), lightDay: false }),
      achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, title: a.title, description: a.description, rule: a.rule, badge: a.badge, unlocked: unlocked.has(a.id) })),
      cosmetics: unlockedCosmetics(summary.level.level, unlocked),
    };
  }

  @Get('reflection/current')
  async reflection(@CurrentUser() user: { id: string }) {
    const state = await this.sync.loadState(user.id);
    const tz = state.preferences.timezone;
    const key = localDateKey(Date.now(), tz);
    return weeklySummary(state, weekStartOfKey(key), Date.now());
  }
}
