'use client';

import { useEffect, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { live, logFocus } from '@nextstep/engine';
import { currentSessionLabels } from '@nextstep/scheduler';
import { useDerived } from './derived';
import { formatMinutes, formatTimeOfDay } from './shared';
import { useDemo } from './store';
import styles from './demo.module.css';

const OBSTACLES = ['Data ran out', 'Power cut', 'Work ran late', 'Too tired', 'Family needed me', 'Hard to focus', 'Topic was confusing'];

interface TimerState {
  startedAt: number | null;
  /** Accumulated ms before the current run. Timestamps, not intervals, so time survives re-renders and tab switches. */
  accumulated: number;
  running: boolean;
}

export function CheckIn({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const demo = useDemo();
  const d = useDerived();
  const { app } = demo;
  const session = app.sessions.find((s) => s.id === sessionId);
  // The step this session is for: open steps mapped onto the task's sessions from this one on.
  const labelMap = session ? currentSessionLabels(live(app.sessions), live(app.subtasks), Date.parse(session.startAt)) : null;
  const sessionLabel = session ? (labelMap?.has(session.id) ? labelMap.get(session.id)! : (session.label ?? null)) : null;
  const task = session ? d.tasks.get(session.taskId) : undefined;
  const subtasks = live(app.subtasks)
    .filter((s) => s.taskId === task?.id && !s.done)
    .sort((a, b) => a.position - b.position);
  const [timer, setTimer] = useState<TimerState>({ startedAt: null, accumulated: 0, running: false });
  const [, tick] = useState(0);
  const [done, setDone] = useState<string[]>(() => {
    const match = subtasks.find((s) => s.title === sessionLabel);
    return match ? [match.id] : [];
  });
  const [note, setNote] = useState('');
  const [remaining, setRemaining] = useState(() => Math.max(0, (task?.remainingMinutes ?? 0) - (session?.minutes ?? 0)));
  const [readiness, setReadiness] = useState<'ready' | 'more_practice' | 'unsure' | null>(null);
  const [breakTaken, setBreakTaken] = useState(true);
  const [obstacles, setObstacles] = useState<string[]>([]);

  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  if (!session || !task) return <p>This session no longer exists.</p>;

  const elapsedMs = timer.accumulated + (timer.running && timer.startedAt ? Date.now() - timer.startedAt : 0);
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const mmss = `${String(Math.floor(elapsedMs / 60000)).padStart(2, '0')}:${String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')}`;
  const usedTimer = elapsedMs > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const focusMinutes = usedTimer && elapsedMin >= 1 ? elapsedMin : session.minutes;
    const endedAt = Math.max(demo.clock, Date.parse(session.endAt));
    const r = logFocus(
      app,
      {
        taskId: task.id,
        sessionId: session.id,
        mode: usedTimer ? 'timer' : 'manual',
        startedAt: session.startAt,
        endedAt: new Date(endedAt).toISOString(),
        focusMinutes,
        breakCount: breakTaken ? 1 : 0,
        finishedNote: note || null,
        remainingMinutes: remaining,
        readiness,
        obstacles,
        completedSubtaskIds: done,
      },
      { ...demo.ctx(), now: endedAt },
    );
    const nextAction = live(app.proposals).some((p) => p.status === 'accepted' && !p.nextActionCompletedAt && p.nextActionSessionId === session.id);
    demo.commit(r, { guide: nextAction ? ['next_action'] : [], toast: 'Session logged', advanceClockTo: endedAt });
    onClose();
  };

  return (
    <form className={styles.stack} onSubmit={submit}>
      <p className={styles.muted}>
        {task.title} · {formatTimeOfDay(Date.parse(session.startAt), d.tz)} · planned {formatMinutes(session.minutes)}
      </p>

      <section className={`${styles.card} ${styles.timerCard}`} aria-label="Optional focus timer">
        <p className={styles.timerValue} aria-live="off">
          {mmss}
        </p>
        <div className={styles.row}>
          {!timer.running ? (
            <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setTimer((t) => ({ ...t, running: true, startedAt: Date.now() }))}>
              <Play size={16} aria-hidden /> {timer.accumulated ? 'Resume' : 'Start timer'}
            </button>
          ) : (
            <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setTimer((t) => ({ running: false, startedAt: null, accumulated: t.accumulated + (t.startedAt ? Date.now() - t.startedAt : 0) }))}>
              <Pause size={16} aria-hidden /> Pause
            </button>
          )}
          {usedTimer && (
            <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnGhost}`} onClick={() => setTimer({ running: false, startedAt: null, accumulated: 0 })}>
              <Square size={16} aria-hidden /> Reset
            </button>
          )}
        </div>
        <p className={styles.fine}>The timer is optional. In this demo you can log the full planned session without waiting.</p>
      </section>

      {subtasks.length > 0 && (
        <fieldset className={styles.fieldset}>
          <legend>What did you finish?</legend>
          {subtasks.map((s) => (
            <label key={s.id} className={styles.checkRow}>
              <input type="checkbox" checked={done.includes(s.id)} onChange={(e) => setDone((ids) => (e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id)))} />
              <span>
                <strong>{s.title}</strong>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <label className={styles.field}>
        <span>Anything else you finished? (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. insert works, delete half done" />
      </label>
      <label className={styles.field}>
        <span>How much work remains on this task? (minutes)</span>
        <input type="number" min={0} max={6000} step={5} value={remaining} onChange={(e) => setRemaining(Math.max(0, Number(e.target.value) || 0))} />
      </label>
      <fieldset className={styles.fieldset}>
        <legend>Ready to move on, or need more practice?</legend>
        <div className={styles.chips}>
          {(
            [
              ['ready', 'Ready to move on'],
              ['more_practice', 'Need more practice'],
              ['unsure', 'Not sure'],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className={styles.chip}>
              <input type="radio" name="ready" checked={readiness === v} onChange={() => setReadiness(v)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <p className={styles.fine}>This is your own sense of readiness, not a measure of mastery.</p>
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend>Anything get in the way? (optional)</legend>
        <div className={styles.chips}>
          {OBSTACLES.map((o) => (
            <label key={o} className={styles.chip}>
              <input type="checkbox" checked={obstacles.includes(o)} onChange={(e) => setObstacles((xs) => (e.target.checked ? [...xs, o] : xs.filter((x) => x !== o)))} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={breakTaken} onChange={(e) => setBreakTaken(e.target.checked)} />
        <span>
          <strong>I’ll take (or took) a proper break</strong>
          <small>Breaks earn a small bonus. Rest is part of the plan.</small>
        </span>
      </label>
      <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
        {usedTimer ? `Save ${formatMinutes(Math.max(1, elapsedMin))} of focus` : `I did this session (${formatMinutes(session.minutes)})`}
      </button>
    </form>
  );
}
