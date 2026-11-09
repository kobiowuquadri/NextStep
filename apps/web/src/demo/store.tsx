'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDaysToKey, instantAt, localDateKey, weekdayOfKey, type RecoveryInput } from '@nextstep/contracts';
import { buildTobiScenario, DEMO_TIMEZONE } from '@nextstep/demo-data';
import {
  acceptRecovery,
  achievementDef,
  type ActionResult,
  type AppState,
  type Ctx,
  previewRecovery,
  type RecoveryProposal,
} from '@nextstep/engine';
import type { AchievementDef } from '@nextstep/gamification';

const STORAGE_KEY = 'nextstep-demo-v1';

export type GuideStep = 'view_week' | 'edit_task' | 'mark_missed' | 'less_time' | 'accept' | 'next_action' | 'achievement';

export const GUIDE: Array<{ id: GuideStep; label: string }> = [
  { id: 'view_week', label: 'View Tobi’s week' },
  { id: 'edit_task', label: 'Add or edit a task' },
  { id: 'mark_missed', label: 'Mark a session as missed' },
  { id: 'less_time', label: 'Report having less time' },
  { id: 'accept', label: 'Review and accept a recovery plan' },
  { id: 'next_action', label: 'Complete the next action' },
  { id: 'achievement', label: 'Unlock an achievement' },
];

interface Persisted {
  version: 1;
  app: AppState;
  clock: number;
  guide: Partial<Record<GuideStep, boolean>>;
  overloaded: boolean;
}

/** The demo runs on a simulated clock: the next weekday at 17:45 Lagos time, so the evening plan is always ahead. */
export function initialDemoClock(realNow = Date.now()): number {
  let key = localDateKey(realNow, DEMO_TIMEZONE);
  while ([0, 6].includes(weekdayOfKey(key))) key = addDaysToKey(key, 1);
  return instantAt(key, '17:45', DEMO_TIMEZONE);
}

function fresh(overloaded = false): Persisted {
  const clock = initialDemoClock();
  return { version: 1, app: buildTobiScenario(clock, { overloaded }), clock, guide: {}, overloaded };
}

function load(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Persisted;
    return p.version === 1 && p.app?.userId ? p : null;
  } catch {
    return null;
  }
}

function save(p: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode): demo still works in memory */
  }
}

export interface Toast {
  id: number;
  text: string;
  tone: 'reward' | 'info' | 'warning';
}

interface DemoContextValue {
  ready: boolean;
  app: AppState;
  clock: number;
  guide: Partial<Record<GuideStep, boolean>>;
  overloaded: boolean;
  celebration: AchievementDef | null;
  levelUp: number | null;
  toasts: Toast[];
  ctx: () => Ctx;
  /** Apply an engine result: persist, toast awards, celebrate unlocks. */
  commit: (r: ActionResult | { error: string; reason?: string }, opts?: { guide?: GuideStep[]; toast?: string; advanceClockTo?: number }) => boolean;
  mark: (...steps: GuideStep[]) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissCelebration: () => void;
  reset: (overloaded?: boolean) => void;
  preview: (input: RecoveryInput) => RecoveryProposal;
  accept: (p: RecoveryProposal) => { ok: true } | { ok: false; reason: string; fresh: RecoveryProposal };
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted | null>(null);
  const [celebrations, setCelebrations] = useState<AchievementDef[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    const p = load() ?? fresh();
    setData(p);
    save(p);
  }, []);

  const update = useCallback((fn: (p: Persisted) => Persisted) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const mark = useCallback((...steps: GuideStep[]) => update((p) => ({ ...p, guide: { ...p.guide, ...Object.fromEntries(steps.map((s) => [s, true])) } })), [update]);

  const ctx = useCallback((): Ctx => ({ now: data?.clock ?? Date.now(), newId: () => crypto.randomUUID() }), [data?.clock]);

  const commit = useCallback<DemoContextValue['commit']>(
    (r, opts = {}) => {
      if ('error' in r) {
        toast(r.reason && r.reason.length > 20 ? r.reason : 'That change could not be applied.', 'warning');
        return false;
      }
      const steps = [...(opts.guide ?? [])];
      if (r.unlocked.length > 0) steps.push('achievement');
      update((p) => ({
        ...p,
        app: r.state,
        clock: opts.advanceClockTo && opts.advanceClockTo > p.clock ? opts.advanceClockTo : p.clock,
        guide: { ...p.guide, ...Object.fromEntries(steps.map((s) => [s, true])) },
      }));
      const xp = r.awards.reduce((a, w) => a + w.entry.xp, 0);
      const capped = r.awards.some((w) => w.result === 'capped');
      if (xp > 0) toast(`+${xp} XP${opts.toast ? ` · ${opts.toast}` : ''}${capped ? ' · daily XP limit reached' : ''}`, 'reward');
      else if (capped) toast(`${opts.toast ? `${opts.toast} · ` : ''}Daily XP limit reached — your progress still counts`);
      else if (opts.toast) toast(opts.toast);
      if (r.unlocked.length > 0) setCelebrations((c) => [...c, ...r.unlocked]);
      if (r.levelUp) setLevelUp(r.levelUp.to);
      return true;
    },
    [toast, update],
  );

  const reset = useCallback((overloaded = false) => {
    const p = fresh(overloaded);
    setData(p);
    save(p);
    setCelebrations([]);
    setLevelUp(null);
  }, []);

  const value = useMemo<DemoContextValue | null>(() => {
    if (!data) return null;
    return {
      ready: true,
      app: data.app,
      clock: data.clock,
      guide: data.guide,
      overloaded: data.overloaded,
      celebration: celebrations[0] ?? null,
      levelUp,
      toasts,
      ctx,
      commit,
      mark,
      toast,
      dismissCelebration: () => {
        // Show queued badges first, then the level-up.
        if (celebrations.length > 0) setCelebrations((c) => c.slice(1));
        else setLevelUp(null);
      },
      reset,
      preview: (input) => previewRecovery(data.app, input, { now: data.clock, newId: () => crypto.randomUUID() }),
      accept: (proposal) => {
        const r = acceptRecovery(data.app, proposal, { now: data.clock, newId: () => crypto.randomUUID() });
        if ('error' in r) {
          return { ok: false, reason: r.reason ?? 'stale', fresh: previewRecovery(data.app, proposal.input, { now: data.clock, newId: () => crypto.randomUUID() }) };
        }
        commit(r, { guide: ['accept'], toast: 'Plan recovered' });
        return { ok: true };
      },
    };
  }, [data, celebrations, levelUp, toasts, ctx, commit, mark, toast, reset]);

  if (!value) {
    return (
      <div role="status" style={{ padding: 48, textAlign: 'center' }}>
        Loading the demo…
      </div>
    );
  }
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const v = useContext(DemoContext);
  if (!v) throw new Error('useDemo outside DemoProvider');
  return v;
}

export { achievementDef };
