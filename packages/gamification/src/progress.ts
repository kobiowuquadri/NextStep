import { addDaysToKey, diffDaysKeys, weekStartOfKey, type MascotAccessory, type MascotSkin } from '@nextstep/contracts';
import { totalXp, type LedgerEntry } from './ledger.js';

// ─── Levels ─────────────────────────────────────────────────────────────────

/** Cumulative XP needed to reach level n: 25·(n−1)·(n+2). L2 = 100, L3 = 250, L4 = 450, L5 = 700 … */
export function xpForLevel(level: number): number {
  return 25 * (level - 1) * (level + 2);
}

export const LEVEL_NAMES = [
  'Trailhead',
  'First Steps',
  'Path Finder',
  'Steady Stride',
  'Bridge Builder',
  'Hill Climber',
  'Route Planner',
  'Comeback Captain',
  'Trail Blazer',
  'Ridge Walker',
  'Summit Seeker',
  'Horizon Keeper',
] as const;

export interface LevelInfo {
  level: number;
  name: string;
  xp: number;
  levelStartXp: number;
  nextLevelXp: number;
  /** 0–1 progress through the current level. */
  progress: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    name: LEVEL_NAMES[level - 1] ?? `Explorer ${level}`,
    xp,
    levelStartXp: start,
    nextLevelXp: next,
    progress: (xp - start) / (next - start),
  };
}

// ─── Activity & steady weeks ───────────────────────────────────────────────

const ACTIVITY_TYPES = new Set(['task_completed', 'subtask_completed', 'focus_completed', 'goal_checkin', 'practice_completed', 'checkin_completed']);

export function activeDays(ledger: readonly LedgerEntry[]): Set<string> {
  return new Set(ledger.filter((e) => !e.deletedAt && e.status !== 'rejected' && ACTIVITY_TYPES.has(e.type)).map((e) => e.localDate));
}

export interface SteadyWeeks {
  thisWeekStart: string;
  activeDaysThisWeek: number;
  goal: number;
  /** Consecutive completed weeks that met the goal (current week counts once met). Never negative, never erases XP. */
  streak: number;
  weeksMet: number;
}

/**
 * Weekly participation instead of daily streaks: missing a day never resets
 * anything, and an unmet week only pauses the streak count.
 */
export function steadyWeeks(ledger: readonly LedgerEntry[], today: string, goal: number): SteadyWeeks {
  const days = activeDays(ledger);
  const thisWeek = weekStartOfKey(today);
  const countWeek = (start: string) => Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i)).filter((d) => days.has(d)).length;
  const weeks = new Map<string, number>();
  for (const d of days) {
    const w = weekStartOfKey(d);
    weeks.set(w, (weeks.get(w) ?? 0) + 1);
  }
  let weeksMet = 0;
  for (const n of weeks.values()) if (n >= goal) weeksMet++;
  let streak = 0;
  const current = countWeek(thisWeek);
  if (current >= goal) streak++;
  let w = addDaysToKey(thisWeek, -7);
  while (countWeek(w) >= goal) {
    streak++;
    w = addDaysToKey(w, -7);
  }
  return { thisWeekStart: thisWeek, activeDaysThisWeek: current, goal, streak, weeksMet };
}

/** Days since the last activity before `today` (for "welcome back"). */
export function daysAway(ledger: readonly LedgerEntry[], today: string): number | null {
  const prior = [...activeDays(ledger)].filter((d) => d < today).sort();
  const last = prior[prior.length - 1];
  return last ? diffDaysKeys(last, today) : null;
}

// ─── Achievements ───────────────────────────────────────────────────────────

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** Exact unlock rule, shown to students. */
  rule: string;
  badge: string;
  reward?: { skin?: MascotSkin; accessory?: MascotAccessory };
  check: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  ledger: readonly LedgerEntry[];
  level: number;
  steady: SteadyWeeks;
}

const count = (ledger: readonly LedgerEntry[], type: string, pred: (e: LedgerEntry) => boolean = () => true) =>
  ledger.filter((e) => !e.deletedAt && e.status !== 'rejected' && e.type === type && pred(e)).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_step',
    title: 'First Step',
    description: 'You finished something real.',
    rule: 'Complete a task worth full XP (not a quick task), or finish a focus session of 10+ minutes.',
    badge: 'footprint',
    reward: { accessory: 'headphones' },
    check: ({ ledger }) => count(ledger, 'task_completed', (e) => e.xp >= 10) > 0 || count(ledger, 'focus_completed', (e) => Number(e.meta.focusMinutes ?? 0) >= 10) > 0,
  },
  {
    id: 'back_on_track',
    title: 'Back on Track',
    description: 'Plans changed and you kept moving.',
    rule: 'Accept a recovery plan and complete its next action.',
    badge: 'reroute',
    reward: { skin: 'coral' },
    check: ({ ledger }) => count(ledger, 'recovery_next_action') > 0,
  },
  {
    id: 'weekly_reflection',
    title: 'Weekly Reflection',
    description: 'You looked back to plan forward.',
    rule: 'Complete a weekly reflection.',
    badge: 'notebook',
    reward: { skin: 'midnight' },
    check: ({ ledger }) => count(ledger, 'reflection_completed') > 0,
  },
  {
    id: 'steady_progress',
    title: 'Steady Progress',
    description: 'You met the weekly rhythm you chose.',
    rule: 'Be active on as many days in one week as your personal weekly goal.',
    badge: 'calendar',
    reward: { skin: 'mint' },
    check: ({ steady }) => steady.weeksMet > 0,
  },
  {
    id: 'small_wins',
    title: 'Small Wins',
    description: 'Little steps add up.',
    rule: 'Finish 8 meaningful steps (subtasks or tasks).',
    badge: 'blocks',
    reward: { accessory: 'starpin' },
    check: ({ ledger }) => count(ledger, 'subtask_completed') + count(ledger, 'task_completed', (e) => e.xp >= 10) >= 8,
  },
  {
    id: 'planner',
    title: 'Map Maker',
    description: 'You built your first plan.',
    rule: 'Generate or build your first study plan.',
    badge: 'map',
    reward: { accessory: 'backpack' },
    check: ({ ledger }) => count(ledger, 'plan_created') > 0,
  },
  {
    id: 'rest_respected',
    title: 'Rest Respected',
    description: 'Breaks are part of the work.',
    rule: 'Take a break after 5 focus sessions.',
    badge: 'leaf',
    reward: { accessory: 'scarf' },
    check: ({ ledger }) => count(ledger, 'focus_completed', (e) => e.meta.breakTaken === true) >= 5,
  },
  {
    id: 'curious_mind',
    title: 'Curious Mind',
    description: 'You checked your understanding.',
    rule: 'Finish 3 different practice checks.',
    badge: 'bulb',
    reward: { accessory: 'glasses' },
    check: ({ ledger }) => count(ledger, 'practice_completed') >= 3,
  },
  {
    id: 'comeback',
    title: 'Welcome Back',
    description: 'Returning is a skill.',
    rule: 'Come back after 3 or more days away.',
    badge: 'door',
    reward: { skin: 'lagoon' },
    check: ({ ledger }) => count(ledger, 'welcome_back', (e) => e.xp > 0) > 0,
  },
  {
    id: 'bridge_builder',
    title: 'Bridge Builder',
    description: 'Level 5 on your journey.',
    rule: 'Reach level 5 (700 XP).',
    badge: 'bridge',
    reward: { skin: 'marigold' },
    check: ({ level }) => level >= 5,
  },
];

export function evaluateAchievements(ctx: AchievementContext, alreadyUnlocked: ReadonlySet<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !alreadyUnlocked.has(a.id) && a.check(ctx));
}

// ─── Cosmetics ──────────────────────────────────────────────────────────────

export const LEVEL_REWARDS: Array<{ level: number; skin?: MascotSkin; accessory?: MascotAccessory }> = [
  { level: 3, accessory: 'cap' },
  { level: 6, accessory: 'gradcap' },
];

/** Cosmetic unlocks only. Nothing here gates learning, planning or accessibility features. */
export function unlockedCosmetics(level: number, achievementIds: ReadonlySet<string>): { skins: MascotSkin[]; accessories: MascotAccessory[] } {
  const skins = new Set<MascotSkin>(['violet']);
  const accessories = new Set<MascotAccessory>(['none']);
  for (const r of LEVEL_REWARDS) {
    if (level >= r.level) {
      if (r.skin) skins.add(r.skin);
      if (r.accessory) accessories.add(r.accessory);
    }
  }
  for (const a of ACHIEVEMENTS) {
    if (!achievementIds.has(a.id) || !a.reward) continue;
    if (a.reward.skin) skins.add(a.reward.skin);
    if (a.reward.accessory) accessories.add(a.reward.accessory);
  }
  return { skins: [...skins], accessories: [...accessories] };
}

export interface ProgressSummary {
  level: LevelInfo;
  totalXp: number;
  pendingXp: number;
  steady: SteadyWeeks;
}

export function summariseProgress(ledger: readonly LedgerEntry[], today: string, weeklyGoal: number): ProgressSummary {
  const xp = totalXp(ledger);
  return {
    level: levelFromXp(xp),
    totalXp: xp,
    pendingXp: ledger.filter((e) => e.status === 'pending' && !e.deletedAt).reduce((a, e) => a + e.xp, 0),
    steady: steadyWeeks(ledger, today, weeklyGoal),
  };
}
