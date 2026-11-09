import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { BookOpenCheck, Check, Sparkles, Trash2 } from '../../ui/icons';
import { addDaysToKey, formatInstant, formatMinutes, formatTimeOfDay, instantAt, localDateKey, TASK_KINDS, type AiBreakdownResponse, type TaskKind } from '@nextstep/contracts';
import { LEARNING_RESOURCES } from '@nextstep/demo-data';
import { addSubtask, completeTask, createTask, deleteTask, generatePlanAction, live, toggleSubtask, updateTask, currentRevision, type ActionResult } from '@nextstep/engine';
import { authedRequest } from '../../lib/api';
import { useDerived } from '../../lib/derive';
import { useApp } from '../../lib/store';
import { Button, Card, Choice, Field, ListRow, Notice, Row, Screen, StatusChip, T, Toggle } from '../../ui/kit';
import { DatePick, TimePick } from '../../ui/pickers';
import { useTheme } from '../../ui/theme';

const KIND_LABEL: Record<string, string> = { assignment: 'Assignment', exam: 'Exam / test', revision: 'Revision', reading: 'Reading', project: 'Project', practice: 'Practice', personal: 'Personal' };

export default function TaskScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, run, account, online } = useApp();
  const d = useDerived();
  const isNew = id === 'new';
  const existing = !isNew && state ? state.tasks.find((t) => t.id === id && !t.deletedAt) : undefined;
  const tz = state?.preferences.timezone ?? 'Africa/Lagos';
  const today = localDateKey(Date.now(), tz);
  const due = existing?.dueAt ? Date.parse(existing.dueAt) : null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [kind, setKind] = useState<TaskKind>(existing?.kind ?? 'assignment');
  const [courseId, setCourseId] = useState(existing?.courseId ?? '');
  const [hasDue, setHasDue] = useState(existing ? !!existing.dueAt : true);
  const [dueDate, setDueDate] = useState(due ? localDateKey(due, tz) : addDaysToKey(today, 4));
  const [dueTime, setDueTime] = useState(due ? formatTimeOfDay(due, tz) : '18:00');
  const [estimate, setEstimate] = useState(String(existing?.estimatedMinutes ?? 60));
  const [remaining, setRemaining] = useState(String(existing?.remainingMinutes ?? 60));
  const [importance, setImportance] = useState(existing?.importance ?? 2);
  const [splittable, setSplittable] = useState(existing?.splittable ?? true);
  const [optional, setOptional] = useState(existing?.optional ?? false);
  const [needsNet, setNeedsNet] = useState(existing?.connectivity === 'online');
  const [steps, setSteps] = useState<string[]>([]);
  const [newStep, setNewStep] = useState('');
  const [suggested, setSuggested] = useState<AiBreakdownResponse | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'busy' | string>('idle');
  const [error, setError] = useState<string | null>(null);
  if (!state || !d) return null;
  if (!isNew && !existing) {
    return (
      <Screen>
        <Notice tone="warning">This task no longer exists — it may have been deleted on another device.</Notice>
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }
  const subtasks = existing ? live(state.subtasks).filter((s) => s.taskId === existing.id).sort((a, b) => a.position - b.position) : [];
  const plan = existing ? d.taskPlans.get(existing.id) : undefined;
  const resources = existing ? LEARNING_RESOURCES.filter((r) => existing.resourceIds.includes(r.id)) : [];
  const courses = live(state.courses);

  const withReplan = (r: ActionResult | { error: string }): ActionResult | { error: 'INVALID' } => {
    if ('error' in r) return { error: 'INVALID' };
    if (state.preferences.planningMode === 'manual') return r;
    const { result } = generatePlanAction(r.state, { now: Date.now(), newId: () => Crypto.randomUUID() });
    return { ...result, mutations: [...r.mutations, ...result.mutations], awards: [...r.awards, ...result.awards], unlocked: [...r.unlocked, ...result.unlocked] };
  };

  const save = async () => {
    const est = Number(estimate);
    if (!title.trim()) return setError('Give the task a title.');
    if (!Number.isFinite(est) || est < 5) return setError('Estimate at least 5 minutes.');
    const fields = {
      title: title.trim(),
      description: description.trim() || null,
      kind,
      courseId: courseId || null,
      dueAt: hasDue ? new Date(instantAt(dueDate, dueTime, tz)).toISOString() : null,
      estimatedMinutes: est,
      importance,
      splittable,
      optional,
      connectivity: needsNet ? ('online' as const) : ('any' as const),
    };
    const base = currentRevision(state);
    const res = await run(
      (s, ctx) => withReplan(existing ? updateTask(s, existing.id, { ...fields, remainingMinutes: Math.max(0, Number(remaining) || 0) }, ctx) : createTask(s, fields, ctx, [...steps, ...(suggested?.steps.map((x) => x.title) ?? [])])),
      { batch: state.preferences.planningMode !== 'manual', basePlanRevision: base, toast: existing ? 'Saved · plan updated' : 'Task added · plan updated' },
    );
    if ('error' in res) return setError('Could not save this task.');
    router.back();
  };

  const suggest = async () => {
    if (!account || account.mode !== 'user') return;
    setAiState('busy');
    try {
      const r = await authedRequest<AiBreakdownResponse>(account.userId, 'POST', '/v1/ai/breakdown', { title: title.trim(), description: description.trim() || undefined, kind, estimatedMinutes: Number(estimate) || undefined }, 25_000);
      setSuggested(r);
      setAiState('idle');
    } catch {
      setAiState('Suggestions aren’t available right now. Add steps yourself — it works just the same.');
    }
  };

  return (
    <Screen>
      <T variant="h1">{existing ? 'Task' : 'New task'}</T>
      {plan && (
        <Card tone="subtle" flat>
          <StatusChip status={plan.status} />
          <T variant="small">{plan.explanation}</T>
          {plan.reasons.map((r) => (
            <T key={r} variant="caption" color="textSecondary">
              • {r}
            </T>
          ))}
        </Card>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      <Card>
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={140} placeholder="e.g. Lab report 3" />
        <Field label="Notes (optional)" value={description ?? ''} onChangeText={setDescription} maxLength={2000} multiline />
        <Choice label="Type" value={kind} options={TASK_KINDS.filter((k) => k !== 'personal').map((k) => ({ value: k, label: KIND_LABEL[k]! }))} onChange={setKind} />
        {courses.length > 0 && <Choice label="Course" value={courseId} options={[{ value: '', label: 'None' }, ...courses.map((co) => ({ value: co.id, label: co.code ?? co.title }))]} onChange={setCourseId} />}
        <Toggle label="Has a deadline" hint="The real deadline. Sessions are planned before it." value={hasDue} onChange={setHasDue} />
        {hasDue && (
          <>
            <DatePick label="Due date" today={today} value={dueDate} onChange={setDueDate} days={120} />
            <TimePick label="Due time" value={dueTime} onChange={setDueTime} />
            {existing?.dueAt && <T variant="caption" color="textMuted">Currently due {formatInstant(Date.parse(existing.dueAt), tz)}. Only change this if the deadline officially changed.</T>}
          </>
        )}
        <Field label="Total effort (minutes)" value={estimate} onChangeText={(v) => setEstimate(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
        {existing && <Field label="Remaining (minutes)" value={remaining} onChangeText={(v) => setRemaining(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />}
        <Choice label="Importance" value={importance} options={[{ value: 1, label: 'Low' }, { value: 2, label: 'Normal' }, { value: 3, label: 'High' }, { value: 4, label: 'Critical' }]} onChange={setImportance} />
        <Toggle label="Can be split into sessions" value={splittable} onChange={setSplittable} />
        <Toggle label="Optional" hint="First to pause when a week is overloaded" value={optional} onChange={setOptional} />
        <Toggle label="Needs internet" hint="Only planned in windows you marked as connected" value={needsNet} onChange={setNeedsNet} />
      </Card>

      <Card>
        <T variant="h3">Steps</T>
        {subtasks.map((s) => (
          <Pressable key={s.id} onPress={() => void run((st, ctx) => toggleSubtask(st, s.id, !s.done, ctx) as ActionResult, { toast: s.done ? undefined : 'Step done' })} accessibilityRole="checkbox" accessibilityState={{ checked: s.done }} accessibilityLabel={s.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
            <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: s.done ? c.success : c.surface, alignItems: 'center', justifyContent: 'center' }}>{s.done && <Check size={16} color={c.textOnAccent} />}</View>
            <T style={{ flex: 1, textDecorationLine: s.done ? 'line-through' : 'none' }} color={s.done ? 'textMuted' : 'textPrimary'}>
              {s.title}
            </T>
          </Pressable>
        ))}
        {!existing &&
          steps.map((s, i) => (
            <ListRow key={i} title={s} right={<Pressable onPress={() => setSteps((x) => x.filter((_, j) => j !== i))} accessibilityLabel={`Remove step ${s}`} hitSlop={10}><Trash2 size={18} color={c.textMuted} /></Pressable>} />
          ))}
        <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Add a step" value={newStep} onChangeText={setNewStep} maxLength={140} />
          </View>
          <Button
            label="Add"
            small
            variant="secondary"
            disabled={!newStep.trim()}
            onPress={() => {
              if (existing) void run((st, ctx) => addSubtask(st, existing.id, newStep, ctx), { quiet: true });
              else setSteps((x) => [...x, newStep.trim()]);
              setNewStep('');
            }}
          />
        </Row>
        {account?.mode === 'user' && online && !existing && (
          <Button label="Suggest steps (optional)" small variant="ghost" icon={<Sparkles size={16} color={c.primarySoftText} />} loading={aiState === 'busy'} disabled={!title.trim()} onPress={() => void suggest()} />
        )}
        {aiState !== 'idle' && aiState !== 'busy' && <Notice>{aiState}</Notice>}
        {suggested && (
          <Card tone="primary" flat>
            <T variant="small" weight="800">Suggested steps — review before saving</T>
            {suggested.steps.map((s) => (
              <T key={s.title} variant="small">
                • {s.title} ({s.estimatedMinutes} min)
              </T>
            ))}
            {suggested.note ? <T variant="caption" color="textSecondary">{suggested.note}</T> : null}
            <Row>
              <Button label="Discard" small variant="ghost" onPress={() => setSuggested(null)} />
            </Row>
            <T variant="caption" color="textMuted">These will be added when you save. Edit or remove any you don’t want.</T>
          </Card>
        )}
      </Card>

      {resources.length > 0 && (
        <Card>
          <T variant="h3">Resources</T>
          {resources.map((r) => (
            <ListRow key={r.id} title={r.title} subtitle={`${r.estMinutes} min · not educator-reviewed`} left={<BookOpenCheck size={18} color={c.primarySoftText} />} onPress={() => router.push(`/resources/${r.id}`)} />
          ))}
        </Card>
      )}

      <Button label={existing ? 'Save changes' : 'Add task'} onPress={() => void save()} />
      {existing && existing.status !== 'done' && (
        <Button
          label="Mark complete"
          variant="secondary"
          icon={<Check size={18} color={c.textPrimary} />}
          onPress={async () => {
            await run((s, ctx) => completeTask(s, existing.id, ctx) as ActionResult, { toast: 'Task complete' });
            router.back();
          }}
        />
      )}
      {existing && (
        <Button
          label="Delete task"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete task?', `“${existing.title}” and its planned sessions will be removed on all your devices.`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await run((s, ctx) => deleteTask(s, existing.id, ctx), { toast: 'Task deleted' });
                  router.back();
                },
              },
            ])
          }
        />
      )}
      {existing && (
        <T variant="caption" color="textMuted" center>
          {formatMinutes(existing.remainingMinutes)} left{needsNet ? ' · needs internet' : ''}
        </T>
      )}
    </Screen>
  );
}
