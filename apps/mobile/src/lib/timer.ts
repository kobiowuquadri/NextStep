/**
 * Focus timer state is stored as timestamps (not a ticking counter), so it is
 * correct after navigation, backgrounding, or the app being killed and
 * reopened. The UI simply recomputes elapsed time from these fields.
 */
export interface FocusTimer {
  sessionId: string | null;
  taskId: string | null;
  label: string;
  workMinutes: number;
  breakMinutes: number;
  phase: 'focus' | 'break';
  /** When the current run of the current phase started (null while paused). */
  runningSince: number | null;
  /** Focus milliseconds accumulated before the current run. */
  focusAccumulatedMs: number;
  /** Break milliseconds accumulated before the current run. */
  breakAccumulatedMs: number;
  startedAt: number;
  breaks: number;
  notificationId: string | null;
}

export function newTimer(p: { sessionId: string | null; taskId: string | null; label: string; workMinutes: number; breakMinutes: number }, now: number): FocusTimer {
  return { ...p, phase: 'focus', runningSince: now, focusAccumulatedMs: 0, breakAccumulatedMs: 0, startedAt: now, breaks: 0, notificationId: null };
}

export function focusMs(t: FocusTimer, now: number): number {
  return t.focusAccumulatedMs + (t.phase === 'focus' && t.runningSince ? now - t.runningSince : 0);
}

export function breakMs(t: FocusTimer, now: number): number {
  return t.breakAccumulatedMs + (t.phase === 'break' && t.runningSince ? now - t.runningSince : 0);
}

export function pause(t: FocusTimer, now: number): FocusTimer {
  if (!t.runningSince) return t;
  return t.phase === 'focus'
    ? { ...t, focusAccumulatedMs: focusMs(t, now), runningSince: null }
    : { ...t, breakAccumulatedMs: breakMs(t, now), runningSince: null };
}

export function resume(t: FocusTimer, now: number): FocusTimer {
  return t.runningSince ? t : { ...t, runningSince: now };
}

export function startBreak(t: FocusTimer, now: number): FocusTimer {
  const paused = pause(t, now);
  return { ...paused, phase: 'break', runningSince: now, breaks: t.breaks + 1 };
}

export function backToFocus(t: FocusTimer, now: number): FocusTimer {
  const paused = pause(t, now);
  return { ...paused, phase: 'focus', runningSince: now };
}

/** Milliseconds left in the current phase (negative when over). */
export function remainingMs(t: FocusTimer, now: number): number {
  return t.phase === 'focus' ? t.workMinutes * 60_000 - (focusMs(t, now) % (t.workMinutes * 60_000 || 1)) : t.breakMinutes * 60_000 - breakMs(t, now);
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
