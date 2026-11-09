'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, CalendarX2, Feather, Hourglass, Siren, Split, MoveRight, Scissors, Plus, Minus, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { mascotSvg } from '@nextstep/illustrations';
import { addDaysToKey, type RecoveryInput } from '@nextstep/contracts';
import { keepCurrentPlan, live } from '@nextstep/engine';
import type { RecoveryChange, RecoveryProposal } from '@nextstep/scheduler';
import { CourseDot } from './bits';
import { courseOf, useDerived } from './derived';
import { formatDateKey, formatInstant, formatMinutes, formatTimeOfDay, instantAt, localDateKey } from './shared';
import { useDemo } from './store';
import styles from './demo.module.css';

type Kind = RecoveryInput['kind'];

const REASONS: Array<{ kind: Kind; title: string; hint: string; Icon: typeof Hourglass }> = [
  { kind: 'missed_session', title: 'I missed a session', hint: 'Fit the missed work back in', Icon: CalendarX2 },
  { kind: 'less_time', title: 'I have less time', hint: 'Shrink today to what’s realistic', Icon: Hourglass },
  { kind: 'deadline_changed', title: 'A deadline changed', hint: 'Only if it officially changed', Icon: CalendarClock },
  { kind: 'urgent', title: 'Something urgent came up', hint: 'Clear a day or two', Icon: Siren },
  { kind: 'lighter_day', title: 'I need a lighter day', hint: 'Keep a little, move the rest', Icon: Feather },
];

const CHANGE_META: Record<RecoveryChange['kind'], { label: string; Icon: typeof Split; tone: string }> = {
  moved: { label: 'Moves', Icon: MoveRight, tone: 'calm' },
  split: { label: 'Split', Icon: Split, tone: 'primary' },
  shortened: { label: 'Smaller step', Icon: Scissors, tone: 'reward' },
  added: { label: 'Added', Icon: Plus, tone: 'success' },
  removed: { label: 'Removed', Icon: Minus, tone: 'danger' },
};

export function RecoveryFlow({ initial, onClose, onStartNext }: { initial?: Partial<RecoveryInput> & { kind?: Kind }; onClose: () => void; onStartNext: (sessionId: string) => void }) {
  const demo = useDemo();
  const d = useDerived();
  const { app, clock } = demo;
  const today = d.day;
  const [kind, setKind] = useState<Kind | null>(initial?.kind ?? null);
  const [step, setStep] = useState<'choose' | 'details' | 'preview' | 'done'>(initial?.kind ? (initial.kind === 'missed_session' && initial.sessionIds ? 'preview' : 'details') : 'choose');
  const [minutes, setMinutes] = useState(45);
  const [lightMax, setLightMax] = useState(30);
  const [lightDate, setLightDate] = useState(today);
  const [urgentDays, setUrgentDays] = useState(1);
  const [missedIds, setMissedIds] = useState<string[]>((initial as { sessionIds?: string[] })?.sessionIds ?? []);
  const [deadlineTask, setDeadlineTask] = useState('');
  const [deadlineDate, setDeadlineDate] = useState(addDaysToKey(today, 3));
  const [deadlineTime, setDeadlineTime] = useState('18:00');
  const [confirmed, setConfirmed] = useState(false);
  const [proposal, setProposal] = useState<RecoveryProposal | null>(null);
  const [staleNote, setStaleNote] = useState<string | null>(null);
  const [showBefore, setShowBefore] = useState(false);

  const candidates = useMemo(
    () =>
      live(app.sessions)
        .filter((s) => s.status === 'planned' && Date.parse(s.startAt) > clock - 3 * 86400000 && Date.parse(s.startAt) < clock + 2 * 86400000)
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [app.sessions, clock],
  );
  const deadlineTasks = live(app.tasks).filter((t) => t.dueAt && t.status !== 'done' && !t.goalId);

  const buildInput = (): RecoveryInput | null => {
    switch (kind) {
      case 'missed_session':
        return missedIds.length ? { kind, sessionIds: missedIds } : null;
      case 'less_time':
        return { kind, date: today, availableMinutes: minutes };
      case 'lighter_day':
        return { kind, date: lightDate, maxMinutes: lightMax };
      case 'urgent':
        return { kind, startDate: today, days: urgentDays };
      case 'deadline_changed':
        return deadlineTask && confirmed ? { kind, taskId: deadlineTask, newDueAt: new Date(instantAt(deadlineDate, deadlineTime, d.tz)).toISOString(), confirmedByStudent: true } : null;
      default:
        return null;
    }
  };

  const runPreview = (input: RecoveryInput | null) => {
    if (!input) return;
    setProposal(demo.preview(input));
    setStep('preview');
    if (input.kind === 'less_time') demo.mark('less_time');
  };

  useEffect(() => {
    if (initial?.kind === 'missed_session' && initial.sessionIds?.length) runPreview({ kind: 'missed_session', sessionIds: initial.sessionIds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = () => {
    if (!proposal) return;
    const res = demo.accept(proposal);
    if (!res.ok) {
      setProposal(res.fresh);
      setStaleNote('Your plan changed while you were reviewing, so we rebuilt the proposal. Please check it again.');
      return;
    }
    if (proposal.kind === 'missed_session') demo.mark('mark_missed');
    setStep('done');
  };

  const keep = () => {
    if (proposal) demo.commit(keepCurrentPlan(app, proposal, demo.ctx()), { toast: 'Kept your current plan' });
    onClose();
  };

  const taskTitle = (id: string) => d.tasks.get(id)?.title ?? 'Task';
  const when = (iso: string) => `${formatDateKey(localDateKey(Date.parse(iso), d.tz))} ${formatTimeOfDay(Date.parse(iso), d.tz)}`;

  if (step === 'choose') {
    return (
      <div className={styles.stack}>
        <p className={styles.lead}>What changed? Pick the closest — you can adjust before anything moves.</p>
        <ul className={styles.reasonGrid}>
          {REASONS.map(({ kind: k, title, hint, Icon }) => (
            <li key={k}>
              <button
                type="button"
                className={styles.reasonBtn}
                onClick={() => {
                  setKind(k);
                  setStep('details');
                }}
              >
                <Icon size={24} aria-hidden />
                <span>
                  <strong>{title}</strong>
                  <small>{hint}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (step === 'details') {
    const input = buildInput();
    return (
      <form
        className={styles.stack}
        onSubmit={(e) => {
          e.preventDefault();
          runPreview(buildInput());
        }}
      >
        {kind === 'less_time' && (
          <fieldset className={styles.fieldset}>
            <legend>How much time do you really have today?</legend>
            <div className={styles.chips}>
              {[15, 30, 45, 60, 90].map((m) => (
                <label key={m} className={styles.chip}>
                  <input type="radio" name="minutes" checked={minutes === m} onChange={() => setMinutes(m)} />
                  <span>{m} min</span>
                </label>
              ))}
            </div>
            <p className={styles.muted}>Your usual limit is {formatMinutes(app.preferences.dailyLimitMinutes)}.</p>
          </fieldset>
        )}
        {kind === 'lighter_day' && (
          <>
            <fieldset className={styles.fieldset}>
              <legend>Which day?</legend>
              <div className={styles.chips}>
                {[today, addDaysToKey(today, 1)].map((k, i) => (
                  <label key={k} className={styles.chip}>
                    <input type="radio" name="lday" checked={lightDate === k} onChange={() => setLightDate(k)} />
                    <span>{i === 0 ? 'Today' : 'Tomorrow'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.fieldset}>
              <legend>At most how much study?</legend>
              <div className={styles.chips}>
                {[0, 20, 30, 60].map((m) => (
                  <label key={m} className={styles.chip}>
                    <input type="radio" name="lmax" checked={lightMax === m} onChange={() => setLightMax(m)} />
                    <span>{m === 0 ? 'None' : `${m} min`}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {kind === 'urgent' && (
          <fieldset className={styles.fieldset}>
            <legend>How many days do you need cleared, starting today?</legend>
            <div className={styles.chips}>
              {[1, 2, 3].map((n) => (
                <label key={n} className={styles.chip}>
                  <input type="radio" name="udays" checked={urgentDays === n} onChange={() => setUrgentDays(n)} />
                  <span>
                    {n} day{n > 1 ? 's' : ''}
                  </span>
                </label>
              ))}
            </div>
            <p className={styles.muted}>Take care of what matters. You don’t need to tell us what happened.</p>
          </fieldset>
        )}
        {kind === 'missed_session' && (
          <fieldset className={styles.fieldset}>
            <legend>Which sessions didn’t happen (or won’t)?</legend>
            {candidates.length === 0 && <p className={styles.muted}>No recent or upcoming sessions to choose from.</p>}
            <div className={styles.stack}>
              {candidates.map((s) => (
                <label key={s.id} className={styles.checkRow}>
                  <input type="checkbox" checked={missedIds.includes(s.id)} onChange={(e) => setMissedIds((ids) => (e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id)))} />
                  <span>
                    <strong>{s.label ?? taskTitle(s.taskId)}</strong>
                    <small>
                      {when(s.startAt)} · {formatMinutes(s.minutes)}
                      {Date.parse(s.endAt) <= clock ? ' · earlier' : ''}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {kind === 'deadline_changed' && (
          <fieldset className={styles.fieldset}>
            <legend>Which deadline changed officially?</legend>
            <label className={styles.field}>
              <span>Task</span>
              <select value={deadlineTask} onChange={(e) => setDeadlineTask(e.target.value)} required>
                <option value="">Choose a task</option>
                {deadlineTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} (now {formatInstant(Date.parse(t.dueAt!), d.tz)})
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>New date</span>
                <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} required />
              </label>
              <label className={styles.field}>
                <span>Time</span>
                <input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} required />
              </label>
            </div>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>
                <strong>My lecturer or course officially changed this deadline.</strong>
                <small>NextStep never moves a real deadline on its own.</small>
              </span>
            </label>
          </fieldset>
        )}
        <div className={styles.row}>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!input}>
            Show me the new plan <ArrowRight size={18} aria-hidden />
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setStep('choose')}>
            Back
          </button>
        </div>
      </form>
    );
  }

  if (step === 'preview' && proposal) {
    const p = proposal;
    const next = p.nextAction;
    return (
      <div className={styles.stack}>
        {staleNote && (
          <p className={`${styles.notice} ${styles.noticeWarning}`} role="status">
            {staleNote}
          </p>
        )}
        <div className={styles.previewHead}>
          <div className={styles.previewMascot} aria-hidden dangerouslySetInnerHTML={{ __html: mascotSvg({ pose: 'recovery', skin: app.preferences.mascotSkin, accessory: app.preferences.mascotAccessory }) }} />
          <div>
            <h3 className={styles.previewTitle}>{p.headline}</h3>
            <p className={styles.muted}>{p.subline}</p>
          </div>
        </div>

        {next && (
          <section className={`${styles.card} ${styles.nextCard}`} aria-label="Your next step">
            <p className={styles.kicker}>Your next step</p>
            <h4 className={styles.nextTitle}>
              <CourseDot color={courseOf(d, d.tasks.get(next.taskId))?.color} /> {next.label ?? next.taskTitle}
            </h4>
            <p className={styles.nextMeta}>
              {formatMinutes(next.minutes)} · {when(next.startAt)}
            </p>
          </section>
        )}

        <section aria-labelledby="chg-h">
          <h4 id="chg-h" className={styles.sectionLabel}>
            What changes ({p.changes.length})
          </h4>
          {p.changes.length === 0 && <p className={styles.muted}>Nothing needs to move.</p>}
          <ul className={styles.changeList}>
            {p.changes.map((c) => {
              const meta = CHANGE_META[c.kind];
              return (
                <li key={c.taskId + c.kind} className={styles.changeItem}>
                  <span className={`${styles.changeBadge} ${styles['tone_' + meta.tone]}`}>
                    <meta.Icon size={14} aria-hidden /> {meta.label}
                  </span>
                  <strong>{c.taskTitle}</strong>
                  <div className={styles.fromTo}>
                    <span className={styles.fromList}>{c.from.length ? c.from.map((f) => `${when(f.startAt)} (${f.minutes}m)`).join(', ') : '—'}</span>
                    <ArrowRight size={14} aria-label="becomes" />
                    <span className={styles.toList}>{c.to.length ? c.to.map((f) => `${when(f.startAt)} (${f.minutes}m)`).join(', ') : 'not scheduled'}</span>
                  </div>
                  <p className={styles.why}>{c.why}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="same-h">
          <h4 id="same-h" className={styles.sectionLabel}>
            <CheckCircle2 size={16} aria-hidden /> Stays the same ({p.unchanged.length})
          </h4>
          <p className={styles.muted}>{p.unchanged.length > 0 ? p.unchanged.slice(0, 3).map((s) => `${taskTitle(s.taskId)} ${when(s.startAt)}`).join(' · ') + (p.unchanged.length > 3 ? ` and ${p.unchanged.length - 3} more` : '') : 'Everything upcoming was affected.'}</p>
        </section>

        {p.atRisk.length > 0 && (
          <section className={`${styles.card} ${styles.cardDanger}`} aria-labelledby="risk-h">
            <h4 id="risk-h" className={styles.cardTitle}>
              <ShieldAlert size={18} aria-hidden /> At risk
            </h4>
            <ul className={styles.options}>
              {p.atRisk.map((t) => (
                <li key={t.taskId}>
                  <strong>{t.title}</strong>
                  <span>{t.explanation}</span>
                </li>
              ))}
              {p.plan.shortfall?.options.slice(0, 3).map((o) => (
                <li key={o.kind + (o.deferTaskId ?? '')}>
                  <strong>Option: {o.title}</strong>
                  <span>{o.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} aria-expanded={showBefore} onClick={() => setShowBefore((v) => !v)}>
          {showBefore ? 'Hide' : 'Show'} before / after
        </button>
        {showBefore && (
          <div className={styles.compare}>
            {(['before', 'after'] as const).map((side) => (
              <div key={side}>
                <h5>{side === 'before' ? 'Before' : 'After'}</h5>
                <ul>
                  {(side === 'before' ? p.before : p.after).slice(0, 10).map((s) => (
                    <li key={s.id + side} className={side === 'before' && s.status === 'missed' ? styles.struck : ''}>
                      <CourseDot color={courseOf(d, d.tasks.get(s.taskId))?.color} />
                      <span>
                        {when(s.startAt)} · {s.minutes}m<small>{taskTitle(s.taskId)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className={styles.decision}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={accept}>
            Accept changes
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep(kind === 'missed_session' && !candidates.length ? 'choose' : 'details')}>
            Adjust proposal
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={keep}>
            Keep my current plan
          </button>
        </div>
        <p className={styles.fine}>Nothing has changed yet. After accepting you can undo from the Plan history if you haven’t started the new sessions.</p>
      </div>
    );
  }

  if (step === 'done' && proposal) {
    const next = proposal.nextAction;
    return (
      <div className={`${styles.stack} ${styles.doneStep}`}>
        <div className={styles.doneMascot} aria-hidden dangerouslySetInnerHTML={{ __html: mascotSvg({ pose: 'encourage', skin: app.preferences.mascotSkin, accessory: app.preferences.mascotAccessory }) }} />
        <h3 className={styles.previewTitle}>You still have a next step.</h3>
        <p className={styles.muted}>Your plan is updated. Finish the next action to earn Back on Track.</p>
        {next && (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onStartNext(next.sessionId)}>
            Start: {next.label ?? next.taskTitle} ({formatMinutes(next.minutes)})
          </button>
        )}
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>
          Later
        </button>
      </div>
    );
  }
  return null;
}
