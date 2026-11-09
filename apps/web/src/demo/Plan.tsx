'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Bus, Briefcase, Check, Coffee, GraduationCap, Heart, Pin, PinOff, Plus, RefreshCw, Shuffle, X } from 'lucide-react';
import { sceneSvg } from '@nextstep/illustrations';
import { generatePlanAction, live, setSessionPinned } from '@nextstep/engine';
import { CourseDot, Empty, StatusChip } from './bits';
import { commitmentsOn, courseOf, useDerived } from './derived';
import { formatDateKey, formatMinutes, formatTimeOfDay, KIND_LABEL, localDateKey } from './shared';
import { useDemo } from './store';
import { Sheet } from './Sheet';
import type { Opener } from './DemoApp';
import styles from './demo.module.css';

const COMMIT_ICON = { work: Briefcase, commute: Bus, class: GraduationCap, family: Heart, rest: Coffee, worship: Heart, other: Briefcase } as const;

export function PlanView({ open }: { open: Opener }) {
  const demo = useDemo();
  const d = useDerived();
  const [tab, setTab] = useState<'week' | 'tasks'>('week');
  const [day, setDay] = useState(d.day);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { app, mark } = demo;

  useEffect(() => {
    mark('view_week');
  }, [mark]);

  const sessions = live(app.sessions)
    .filter((s) => localDateKey(Date.parse(s.startAt), d.tz) === day && s.status !== 'skipped')
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const commitments = commitmentsOn(app, day);
  const load = d.analysis.days.find((x) => x.date === day);
  const override = live(app.overrides).find((o) => o.date === day);
  const selected = sessionId ? app.sessions.find((s) => s.id === sessionId) : null;
  const selectedTask = selected ? d.tasks.get(selected.taskId) : undefined;
  const shortfall = d.analysis.shortfall;

  type Row = { kind: 'commit'; start: string; node: React.ReactNode } | { kind: 'session'; start: string; node: React.ReactNode };
  const rows: Row[] = [
    ...commitments.map((c) => {
      const Icon = COMMIT_ICON[c.kind] ?? Briefcase;
      return {
        kind: 'commit' as const,
        start: c.start,
        node: (
          <li key={`c-${c.title}-${c.start}`} className={styles.commitRow}>
            <Icon size={16} aria-hidden />
            <span className={styles.grow}>
              <strong>{c.title}</strong>
              <small>
                {c.start}–{c.end}
                {c.protected ? ' · protected' : ''}
              </small>
            </span>
          </li>
        ),
      };
    }),
    ...sessions.map((s) => {
      const t = d.tasks.get(s.taskId);
      const course = courseOf(d, t);
      const past = Date.parse(s.endAt) <= demo.clock && s.status === 'planned';
      return {
        kind: 'session' as const,
        start: formatTimeOfDay(Date.parse(s.startAt), d.tz),
        node: (
          <li key={s.id}>
            <button type="button" className={`${styles.sessionRow} ${s.status !== 'planned' || past ? styles.sessionDim : ''}`} style={{ borderLeftColor: course?.color }} onClick={() => setSessionId(s.id)}>
              <span className={styles.sessionTime}>
                {formatTimeOfDay(Date.parse(s.startAt), d.tz)}
                <small>{formatMinutes(s.minutes)}</small>
              </span>
              <span className={styles.grow}>
                <strong>{d.labelOf(s) ?? t?.title}</strong>
                <small>
                  {d.labelOf(s) ? `${t?.title} · ` : ''}
                  {course?.code ?? 'Personal'}
                </small>
              </span>
              {s.pinned && <Pin size={16} aria-label="Pinned" />}
              {s.status === 'done' && <span className={`${styles.status} ${styles.status_success}`}><Check size={14} aria-hidden /> Done</span>}
              {(s.status === 'missed' || past) && <span className={`${styles.status} ${styles.status_muted}`}>{s.status === 'missed' ? 'Missed' : 'Not logged'}</span>}
            </button>
          </li>
        ),
      };
    }),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className={styles.view}>
      <div className={styles.segmented} role="tablist" aria-label="Plan view">
        <button role="tab" aria-selected={tab === 'week'} onClick={() => setTab('week')}>
          Week
        </button>
        <button role="tab" aria-selected={tab === 'tasks'} onClick={() => setTab('tasks')}>
          Tasks
        </button>
      </div>

      {shortfall && (
        <section className={`${styles.card} ${styles.cardDanger}`} aria-labelledby="short-h">
          <h3 id="short-h" className={styles.cardTitle}>
            <AlertTriangle size={18} aria-hidden /> Not everything fits
          </h3>
          <p>{shortfall.message}</p>
          <ul className={styles.options}>
            {shortfall.options.slice(0, 4).map((o) => (
              <li key={o.kind + (o.deferTaskId ?? '') + (o.taskId ?? '')}>
                <strong>{o.title}</strong>
                <span>{o.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'week' ? (
        <>
          <div className={styles.dayStrip} role="tablist" aria-label="Day">
            {d.week.map((k) => {
              const l = d.analysis.days.find((x) => x.date === k);
              const count = live(app.sessions).filter((s) => localDateKey(Date.parse(s.startAt), d.tz) === k && s.status === 'planned').length;
              return (
                <button key={k} role="tab" aria-selected={k === day} className={styles.dayChip} onClick={() => setDay(k)}>
                  <span>{formatDateKey(k).split(' ')[0]}</span>
                  <strong>{formatDateKey(k, false).split(' ')[0]}</strong>
                  <span className={styles.dayDots} aria-label={`${count} sessions`}>
                    {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                  {l && l.limitMinutes === 0 && <span className="visually-hidden">No study planned</span>}
                </button>
              );
            })}
          </div>

          <div className={styles.dayHead}>
            <h3>{day === d.day ? 'Today' : formatDateKey(day)}</h3>
            {load && (
              <span className={styles.loadText}>
                {formatMinutes(load.plannedMinutes + load.doneMinutes)} of {formatMinutes(load.limitMinutes)}
                {override ? ` · ${override.reason}` : ''}
              </span>
            )}
          </div>
          {load && (
            <div className={styles.loadBar} aria-hidden>
              <span style={{ width: `${Math.min(100, ((load.plannedMinutes + load.doneMinutes) / Math.max(1, load.limitMinutes)) * 100)}%` }} />
            </div>
          )}

          {rows.length === 0 ? (
            <Empty art={sceneSvg('emptyPlan')} title="A free day">
              <p className={styles.muted}>No commitments and no study planned. Rest is part of the plan.</p>
            </Empty>
          ) : (
            <ul className={styles.agenda}>{rows.map((r) => r.node)}</ul>
          )}

          <div className={styles.row}>
            <button type="button" className={`${styles.btn} ${styles.btnEnergy}`} onClick={() => open.recovery()}>
              <Shuffle size={18} aria-hidden /> My plans changed
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => {
                const { result, plan } = generatePlanAction(app, demo.ctx());
                demo.commit(result, { toast: `Replanned: ${plan.newSessions.length} sessions` });
              }}
            >
              <RefreshCw size={18} aria-hidden /> Replan week
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.sectionHeadRow}>
            <h3 className={styles.sectionLabel}>{live(app.tasks).filter((t) => t.status !== 'done' && !t.goalId).length} open tasks</h3>
            <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => open.task()}>
              <Plus size={16} aria-hidden /> Add task
            </button>
          </div>
          <ul className={styles.list}>
            {d.analysis.tasks
              .filter((tp) => !d.tasks.get(tp.taskId)?.goalId)
              .map((tp) => {
                const t = d.tasks.get(tp.taskId)!;
                return (
                  <li key={tp.taskId}>
                    <button type="button" className={styles.taskRow} onClick={() => open.task(tp.taskId)}>
                      <CourseDot color={courseOf(d, t)?.color} />
                      <span className={styles.grow}>
                        <strong>{t.title}</strong>
                        <small>
                          {KIND_LABEL[t.kind]} · {formatMinutes(t.remainingMinutes)} left
                        </small>
                        <small className={styles.explain}>{tp.explanation}</small>
                      </span>
                      <StatusChip status={tp.status} />
                    </button>
                  </li>
                );
              })}
            {live(app.tasks)
              .filter((t) => t.status === 'done' && !t.goalId)
              .map((t) => (
                <li key={t.id}>
                  <button type="button" className={`${styles.taskRow} ${styles.sessionDim}`} onClick={() => open.task(t.id)}>
                    <CourseDot color={courseOf(d, t)?.color} />
                    <span className={styles.grow}>
                      <strong>{t.title}</strong>
                      <small>Completed</small>
                    </span>
                    <StatusChip status="done" />
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      <Sheet open={!!selected} onClose={() => setSessionId(null)} title={(selected ? d.labelOf(selected) : null) ?? selectedTask?.title ?? 'Session'}>
        {selected && (
          <div className={styles.stack}>
            <p className={styles.muted}>
              {selectedTask?.title} · {formatDateKey(localDateKey(Date.parse(selected.startAt), d.tz))} {formatTimeOfDay(Date.parse(selected.startAt), d.tz)}–
              {formatTimeOfDay(Date.parse(selected.endAt), d.tz)} · {formatMinutes(selected.minutes)}
            </p>
            <p className={styles.muted}>This is a work session. The task’s real deadline doesn’t change when sessions move.</p>
            {selected.status === 'planned' ? (
              <div className={styles.stack}>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setSessionId(null); open.checkIn(selected.id); }}>
                  <Check size={18} aria-hidden /> Log this session
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnInk}`}
                  onClick={() => {
                    setSessionId(null);
                    open.recovery({ kind: 'missed_session', sessionIds: [selected.id] });
                  }}
                >
                  <X size={18} aria-hidden /> I missed this — find a new time
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { demo.commit(setSessionPinned(app, selected.id, !selected.pinned, demo.ctx()), { toast: selected.pinned ? 'Unpinned: replanning may move it' : 'Pinned: replanning keeps it here' }); setSessionId(null); }}>
                  {selected.pinned ? <PinOff size={18} aria-hidden /> : <Pin size={18} aria-hidden />} {selected.pinned ? 'Unpin' : 'Pin this time'}
                </button>
              </div>
            ) : (
              <p>
                <StatusChip status={selected.status === 'done' ? 'done' : 'blocked'} /> {selected.status === 'missed' ? 'Marked as missed.' : ''}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
