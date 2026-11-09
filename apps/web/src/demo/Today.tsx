'use client';

import { BookHeart, CalendarClock, CloudOff, Plus, Shuffle, Sparkles, Timer } from 'lucide-react';
import { mascotSvg, sceneSvg } from '@nextstep/illustrations';
import { goalCheckin, goalMinutesThisWeek, live, markSessionMissed, toPlannerInput, type ActionResult } from '@nextstep/engine';
import { optionalExtra } from '@nextstep/scheduler';
import { CourseDot, Empty, StatusChip, XpBar } from './bits';
import { courseOf, useDerived } from './derived';
import { formatInstant, formatMinutes, formatTimeOfDay, relativeDay } from './shared';
import { useDemo } from './store';
import type { Opener } from './DemoApp';
import styles from './demo.module.css';

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function TodayView({ open }: { open: Opener }) {
  const demo = useDemo();
  const d = useDerived();
  const { app, clock } = demo;
  const hour = Number(formatTimeOfDay(clock, d.tz).slice(0, 2));
  const next = d.today.actions[0];
  const rest = d.today.actions.slice(1);
  const nextTask = next ? d.tasks.get(next.taskId) : undefined;
  const goal = live(app.goals).find((g) => g.active);
  const goalDone = goal ? goalMinutesThisWeek(app, goal.id, demo.ctx()) : 0;
  const extra = d.today.actions.length === 0 ? optionalExtra(toPlannerInput(app, clock)) : null;
  const prefs = app.preferences;

  const markAllMissed = () => {
    const ctx = demo.ctx();
    let result: ActionResult | null = null;
    let state = app;
    const mutations: ActionResult['mutations'] = [];
    for (const m of d.today.missedEarlier) {
      result = markSessionMissed(state, m.id, ctx);
      state = result.state;
      mutations.push(...result.mutations);
    }
    if (result) demo.commit({ ...result, state, mutations }, { guide: ['mark_missed'], toast: 'Marked as missed. Nothing else changed.' });
  };

  return (
    <div className={styles.view}>
      <header className={styles.todayHead}>
        <div>
          <p className={styles.dateLine}>{formatInstant(clock, d.tz)}</p>
          <h2 className={styles.greet}>
            {greeting(hour)}, {prefs.displayName}
          </h2>
        </div>
        <div
          className={styles.miniMascot}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: mascotSvg({ pose: d.today.completedForToday ? 'celebrate' : 'welcome', skin: prefs.mascotSkin, accessory: prefs.mascotAccessory }) }}
        />
      </header>

      <button type="button" className={styles.levelCard} onClick={() => open.tab('journey')}>
        <span className={styles.levelBadge}>Lv {d.level.level}</span>
        <span className={styles.levelText}>
          <strong>{d.level.name}</strong>
          <XpBar progress={d.level.progress} label={`Level progress: ${d.xp} of ${d.level.nextLevelXp} XP`} />
          <small>
            {d.xp} XP · {d.level.nextLevelXp - d.xp} to level {d.level.level + 1}
          </small>
        </span>
      </button>

      {d.today.missedEarlier.length > 0 && (
        <section className={`${styles.card} ${styles.cardEnergy}`} aria-labelledby="missed-h">
          <h3 id="missed-h" className={styles.cardTitle}>
            {d.today.missedEarlier.length === 1 ? 'A session didn’t happen' : `${d.today.missedEarlier.length} sessions didn’t happen`}
          </h3>
          <p className={styles.muted}>
            {d.today.missedEarlier
              .slice(0, 2)
              .map((s) => `${d.tasks.get(s.taskId)?.title ?? 'Session'} · ${relativeDay(Date.parse(s.startAt), clock, d.tz)} ${formatTimeOfDay(Date.parse(s.startAt), d.tz)}`)
              .join(' · ')}
            . That’s okay — you still have a next step.
          </p>
          <div className={styles.row}>
            <button type="button" className={`${styles.btn} ${styles.btnInk}`} onClick={() => open.recovery({ kind: 'missed_session', sessionIds: d.today.missedEarlier.map((s) => s.id) })}>
              Find a new time
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={markAllMissed}>
              Just mark missed
            </button>
          </div>
        </section>
      )}

      {next && nextTask ? (
        <section className={`${styles.card} ${styles.nextCard}`} aria-labelledby="next-h">
          <p className={styles.kicker}>
            <Timer size={16} aria-hidden /> {next.inProgress ? 'Happening now' : `Next · ${formatTimeOfDay(Date.parse(next.startAt!), d.tz)}`}
          </p>
          <h3 id="next-h" className={styles.nextTitle}>
            <CourseDot color={courseOf(d, nextTask)?.color} /> {next.label ?? nextTask.title}
          </h3>
          {next.label && <p className={styles.muted}>{nextTask.title}</p>}
          <p className={styles.nextMeta}>
            {formatMinutes(next.minutes)} · {courseOf(d, nextTask)?.code ?? 'Personal'}
          </p>
          <ul className={styles.reasons} aria-label="Why this is next">
            {next.reasons.slice(0, 2).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className={styles.row}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => open.checkIn(next.sessionId!)}>
              Start session
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => open.task(nextTask.id)}>
              Details
            </button>
          </div>
        </section>
      ) : d.today.completedForToday ? (
        <section className={styles.card}>
          <Empty art={sceneSvg('emptyDone')} title="That’s today done.">
            <p className={styles.muted}>{formatMinutes(d.today.doneMinutes)} of focused work. Rest counts too — NextStep won’t pile on more.</p>
          </Empty>
        </section>
      ) : (
        <section className={styles.card}>
          <Empty art={sceneSvg('emptyDone')} title="Nothing else planned today.">
            <p className={styles.muted}>Your next session is on the Plan tab.</p>
            {extra && (
              <p className={styles.extra}>
                <Sparkles size={16} aria-hidden /> Optional, if you have energy: <strong>{extra.title}</strong>
              </p>
            )}
          </Empty>
        </section>
      )}

      <button type="button" className={styles.changedBtn} onClick={() => open.recovery()}>
        <Shuffle size={22} aria-hidden />
        <span>
          <strong>My plans changed</strong>
          <small>Missed something, less time, a new deadline?</small>
        </span>
      </button>

      {rest.length > 0 && (
        <section aria-labelledby="later-h">
          <h3 id="later-h" className={styles.sectionLabel}>
            Later today
          </h3>
          <ul className={styles.list}>
            {rest.map((a) => {
              const t = d.tasks.get(a.taskId);
              return (
                <li key={a.sessionId} className={styles.listRow}>
                  <CourseDot color={courseOf(d, t)?.color} />
                  <span className={styles.grow}>
                    <strong>{a.label ?? a.title}</strong>
                    <small>
                      {formatTimeOfDay(Date.parse(a.startAt!), d.tz)} · {formatMinutes(a.minutes)}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="due-h">
        <div className={styles.sectionHeadRow}>
          <h3 id="due-h" className={styles.sectionLabel}>
            <CalendarClock size={16} aria-hidden /> Upcoming deadlines
          </h3>
          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => open.task()}>
            <Plus size={16} aria-hidden /> Add task
          </button>
        </div>
        <ul className={styles.list}>
          {d.today.upcomingDeadlines.map((u) => {
            const t = d.tasks.get(u.taskId);
            const tp = d.taskPlans.get(u.taskId);
            return (
              <li key={u.taskId}>
                <button type="button" className={styles.listRow} onClick={() => open.task(u.taskId)}>
                  <CourseDot color={courseOf(d, t)?.color} />
                  <span className={styles.grow}>
                    <strong>{u.title}</strong>
                    <small>Due {formatInstant(Date.parse(u.dueAt), d.tz)}</small>
                  </span>
                  {tp && <StatusChip status={tp.status} />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {goal && (
        <section className={`${styles.card} ${styles.cardCalm}`} aria-labelledby="goal-h">
          <h3 id="goal-h" className={styles.cardTitle}>
            <BookHeart size={18} aria-hidden /> {goal.title}
          </h3>
          <XpBar progress={goalDone / goal.weeklyTargetMinutes} label={`${goalDone} of ${goal.weeklyTargetMinutes} minutes this week`} />
          <p className={styles.muted}>
            {goalDone} of {goal.weeklyTargetMinutes} min this week · optional, for you
          </p>
          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => demo.commit(goalCheckin(app, goal.id, goal.sessionMinutes, null, demo.ctx()), { toast: `${goal.sessionMinutes} min logged` })}>
            Log {goal.sessionMinutes} min
          </button>
        </section>
      )}

      <p className={styles.syncNote}>
        <CloudOff size={14} aria-hidden /> Demo mode · saved only in this browser. The mobile app syncs when online.
      </p>
    </div>
  );
}
