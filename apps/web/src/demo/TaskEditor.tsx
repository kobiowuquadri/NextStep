'use client';

import { useState } from 'react';
import { BookOpenCheck, Check, Plus, Trash2 } from 'lucide-react';
import { TASK_KINDS, type TaskKind } from '@nextstep/contracts';
import { LEARNING_RESOURCES } from '@nextstep/demo-data';
import { addSubtask, completeTask, createTask, deleteTask, generatePlanAction, live, toggleSubtask, updateTask, type ActionResult, type AppState } from '@nextstep/engine';
import { StatusChip } from './bits';
import { useDerived } from './derived';
import { formatMinutes, instantAt, KIND_LABEL, localDateKey, formatTimeOfDay, addDaysToKey } from './shared';
import { useDemo } from './store';
import styles from './demo.module.css';

const IMPORTANCE = [
  [1, 'Low'],
  [2, 'Normal'],
  [3, 'High'],
  [4, 'Critical'],
] as const;

/** Replan after an edit, keeping the user's change and the replan in one commit. */
function withReplan(r: ActionResult | { error: string }, ctxNow: () => { now: number; newId: () => string }): ActionResult | { error: string } {
  if ('error' in r) return r;
  const { result } = generatePlanAction(r.state, ctxNow());
  return { ...result, mutations: [...r.mutations, ...result.mutations], awards: [...r.awards, ...result.awards], unlocked: [...r.unlocked, ...result.unlocked] };
}

export function TaskEditor({ taskId, onClose, onPractice }: { taskId?: string; onClose: () => void; onPractice: (resourceId: string) => void }) {
  const demo = useDemo();
  const d = useDerived();
  const { app } = demo;
  const existing = taskId ? app.tasks.find((t) => t.id === taskId) : undefined;
  const due = existing?.dueAt ? Date.parse(existing.dueAt) : null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [kind, setKind] = useState<TaskKind>(existing?.kind ?? 'assignment');
  const [courseId, setCourseId] = useState(existing?.courseId ?? live(app.courses)[0]?.id ?? '');
  const [hasDue, setHasDue] = useState(existing ? !!existing.dueAt : true);
  const [dueDate, setDueDate] = useState(due ? localDateKey(due, d.tz) : addDaysToKey(d.day, 4));
  const [dueTime, setDueTime] = useState(due ? formatTimeOfDay(due, d.tz) : '18:00');
  const [estimate, setEstimate] = useState(existing?.estimatedMinutes ?? 60);
  const [remaining, setRemaining] = useState(existing?.remainingMinutes ?? 60);
  const [importance, setImportance] = useState(existing?.importance ?? 2);
  const [optional, setOptional] = useState(existing?.optional ?? false);
  const [splittable, setSplittable] = useState(existing?.splittable ?? true);
  const [online, setOnline] = useState(existing?.connectivity === 'online');
  const [steps, setSteps] = useState<string[]>([]);
  const [newStep, setNewStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const subtasks = existing ? live(app.subtasks).filter((s) => s.taskId === existing.id).sort((a, b) => a.position - b.position) : [];
  const plan = existing ? d.taskPlans.get(existing.id) : undefined;
  const resources = existing ? LEARNING_RESOURCES.filter((r) => existing.resourceIds.includes(r.id)) : [];

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Give the task a title.');
    if (estimate < 5) return setError('Estimate at least 5 minutes.');
    const fields = {
      title: title.trim(),
      kind,
      courseId: courseId || null,
      dueAt: hasDue ? new Date(instantAt(dueDate, dueTime, d.tz)).toISOString() : null,
      estimatedMinutes: estimate,
      importance,
      optional,
      splittable,
      connectivity: online ? ('online' as const) : ('any' as const),
    };
    const r = existing
      ? updateTask(app, existing.id, { ...fields, remainingMinutes: remaining }, demo.ctx())
      : createTask(app, fields, demo.ctx(), [...steps, newStep].filter((s) => s.trim()));
    if ('error' in r) return setError('Could not save this task.');
    demo.commit(withReplan(r, demo.ctx), { guide: ['edit_task'], toast: existing ? 'Task updated · plan refreshed' : 'Task added · plan refreshed' });
    onClose();
  };

  const act = (fn: (s: AppState) => ActionResult | { error: string }, toast?: string) => demo.commit(fn(app), { toast });

  return (
    <form className={styles.stack} onSubmit={save} noValidate>
      {plan && (
        <div className={styles.explainBox}>
          <StatusChip status={plan.status} />
          <p>{plan.explanation}</p>
          <ul className={styles.reasons}>
            {plan.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p className={`${styles.notice} ${styles.noticeDanger}`} role="alert">
          {error}
        </p>
      )}
      <label className={styles.field}>
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required autoFocus={!existing} placeholder="e.g. Lab report 3" />
      </label>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
            {TASK_KINDS.filter((k) => k !== 'personal').map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Course</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">No course</option>
            {live(app.courses).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} · ` : ''}
                {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={hasDue} onChange={(e) => setHasDue(e.target.checked)} />
        <span>
          <strong>Has a deadline</strong>
          <small>The real deadline. Work sessions are planned before it.</small>
        </span>
      </label>
      {hasDue && (
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Due date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Time (Lagos)</span>
            <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </label>
        </div>
      )}
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Total effort (min)</span>
          <input type="number" min={5} max={6000} step={5} value={estimate} onChange={(e) => setEstimate(Number(e.target.value) || 0)} />
        </label>
        {existing && (
          <label className={styles.field}>
            <span>Remaining (min)</span>
            <input type="number" min={0} max={6000} step={5} value={remaining} onChange={(e) => setRemaining(Number(e.target.value) || 0)} />
          </label>
        )}
      </div>
      <fieldset className={styles.fieldset}>
        <legend>Importance</legend>
        <div className={styles.chips}>
          {IMPORTANCE.map(([v, label]) => (
            <label key={v} className={styles.chip}>
              <input type="radio" name="imp" checked={importance === v} onChange={() => setImportance(v)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className={styles.toggles}>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={splittable} onChange={(e) => setSplittable(e.target.checked)} />
          <span>
            <strong>Can be split into sessions</strong>
          </span>
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={optional} onChange={(e) => setOptional(e.target.checked)} />
          <span>
            <strong>Optional</strong>
            <small>First to pause when a week is overloaded</small>
          </span>
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />
          <span>
            <strong>Needs internet</strong>
            <small>Only planned in windows you marked as connected</small>
          </span>
        </label>
      </div>

      <fieldset className={styles.fieldset}>
        <legend>Steps</legend>
        {existing ? (
          <ul className={styles.stepList}>
            {subtasks.map((s) => (
              <li key={s.id}>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={s.done} onChange={(e) => act((st) => toggleSubtask(st, s.id, e.target.checked, demo.ctx()) as ActionResult, e.target.checked ? 'Step done' : undefined)} />
                  <span className={s.done ? styles.struck : ''}>
                    <strong>{s.title}</strong>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <ul className={styles.stepList}>
            {steps.map((s, i) => (
              <li key={i} className={styles.stepDraft}>
                {s}
                <button type="button" className={styles.iconBtn} aria-label={`Remove step ${s}`} onClick={() => setSteps((xs) => xs.filter((_, j) => j !== i))}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.row}>
          <label className={`${styles.field} ${styles.grow}`}>
            <span className="visually-hidden">New step</span>
            <input value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="Add a step" maxLength={140} />
          </label>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSmall}`}
            disabled={!newStep.trim()}
            onClick={() => {
              if (existing) act((st) => addSubtask(st, existing.id, newStep, demo.ctx()));
              else setSteps((xs) => [...xs, newStep.trim()]);
              setNewStep('');
            }}
          >
            <Plus size={16} aria-hidden /> Add
          </button>
        </div>
        <p className={styles.fine}>Break tasks down yourself. (In the app, optional AI suggestions appear here only if configured — you review them first.)</p>
      </fieldset>

      {resources.length > 0 && (
        <section>
          <h4 className={styles.sectionLabel}>Resources</h4>
          {resources.map((r) => (
            <button key={r.id} type="button" className={styles.listRow} onClick={() => onPractice(r.id)}>
              <BookOpenCheck size={18} aria-hidden />
              <span className={styles.grow}>
                <strong>{r.title}</strong>
                <small>
                  {r.estMinutes} min · {r.questions.length} questions · not educator-reviewed
                </small>
              </span>
            </button>
          ))}
        </section>
      )}

      <div className={styles.decision}>
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
          {existing ? 'Save changes' : 'Add task'}
        </button>
        {existing && existing.status !== 'done' && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => {
              act((st) => completeTask(st, existing.id, demo.ctx()) as ActionResult, 'Task complete');
              onClose();
            }}
          >
            <Check size={18} aria-hidden /> Mark complete
          </button>
        )}
        {existing && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => {
              if (!window.confirm(`Delete "${existing.title}"? Its planned sessions are removed too.`)) return;
              act((st) => deleteTask(st, existing.id, demo.ctx()), 'Task deleted');
              onClose();
            }}
          >
            <Trash2 size={18} aria-hidden /> Delete
          </button>
        )}
      </div>
      {existing && <p className={styles.fine}>Remaining effort: {formatMinutes(existing.remainingMinutes)}. Changing the deadline here is how a real deadline change is recorded — NextStep never does it for you.</p>}
    </form>
  );
}
