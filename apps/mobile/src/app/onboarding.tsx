import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { courseColors } from '@nextstep/design-tokens';
import { formatMinutes, instantAt, isValidTimezone, localDateKey, addDaysToKey } from '@nextstep/contracts';
import { createTask, generatePlanAction, saveAvailability, saveCommitment, saveCourse, updatePreferences, live } from '@nextstep/engine';
import { sceneSvg } from '@nextstep/illustrations';
import { useApp } from '../lib/store';
import { WEEKDAYS } from '../lib/format';
import { Art, Button, Card, Choice, Field, ListRow, Notice, Row, Screen, T } from '../ui/kit';
import { DatePick, TimePick, WeekdayPick } from '../ui/pickers';
import { useTheme } from '../ui/theme';

const STEPS = ['You', 'Courses', 'A task', 'Study time', 'Fixed commitments', 'Session length'] as const;

export default function Onboarding() {
  const { state, run } = useApp();
  const { c } = useTheme();
  const [step, setStep] = useState(0);
  const prefs = state?.preferences;
  const today = prefs ? localDateKey(Date.now(), prefs.timezone) : '';
  // step 0
  const [name, setName] = useState(prefs?.displayName ?? '');
  const [tz, setTz] = useState(prefs?.timezone ?? 'Africa/Lagos');
  const [school, setSchool] = useState(prefs?.institution ?? '');
  // step 1
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  // step 2
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCourse, setTaskCourse] = useState<string | null>(null);
  const [due, setDue] = useState(addDaysToKey(today || '2026-01-01', 5));
  const [dueTime, setDueTime] = useState('18:00');
  const [effort, setEffort] = useState(120);
  // step 3
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [from, setFrom] = useState('19:00');
  const [to, setTo] = useState('21:30');
  const [online, setOnline] = useState(true);
  // step 4
  const [cTitle, setCTitle] = useState('Work');
  const [cKind, setCKind] = useState<'work' | 'class' | 'commute' | 'family' | 'rest'>('work');
  const [cDays, setCDays] = useState<number[]>([1, 3, 5]);
  const [cFrom, setCFrom] = useState('09:00');
  const [cTo, setCTo] = useState('17:00');
  // step 5
  const [session, setSession] = useState(prefs?.defaultSessionMinutes ?? 45);
  const [limit, setLimit] = useState(prefs?.dailyLimitMinutes ?? 180);
  const [error, setError] = useState<string | null>(null);

  if (!state || !prefs) return null;
  const courses = live(state.courses);
  const tasks = live(state.tasks).filter((t) => !t.goalId);
  const windows = live(state.availability);
  const commitments = live(state.commitments);
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  const finish = async () => {
    await run((s, ctx) => updatePreferences(s, { defaultSessionMinutes: session, dailyLimitMinutes: limit, maxSessionMinutes: Math.max(session, 90) }, ctx), { quiet: true });
    await run((s, ctx) => generatePlanAction(s, ctx).result, { batch: true, basePlanRevision: 0, toast: 'Your first plan is ready' });
    await run((s, ctx) => updatePreferences(s, { onboardingCompletedAt: new Date(ctx.now).toISOString() }, ctx), { quiet: true });
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <T variant="label" color="primarySoftText">
          STEP {step + 1} OF {STEPS.length} · {STEPS[step]!.toUpperCase()}
        </T>
        <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? c.primary : c.border }} />
          ))}
        </View>
      </View>
      {error && <Notice tone="danger">{error}</Notice>}

      {step === 0 && (
        <Card>
          <T variant="h2">Hi! Let’s set up your first plan.</T>
          <T color="textSecondary">Only what planning needs. Everything here can change later.</T>
          <Field label="Display name" value={name} onChangeText={setName} maxLength={60} />
          <Field label="Timezone" value={tz} onChangeText={setTz} autoCapitalize="none" hint="Detected from your phone. Lagos is Africa/Lagos." error={tz && !isValidTimezone(tz) ? 'Unknown timezone' : null} />
          <Field label="School or programme (optional)" value={school} onChangeText={setSchool} maxLength={120} hint="Type it in — no directory needed." />
          <Button
            label="Continue"
            disabled={!name.trim() || !isValidTimezone(tz)}
            onPress={async () => {
              await run((s, ctx) => updatePreferences(s, { displayName: name.trim(), timezone: tz, institution: school.trim() || null }, ctx), { quiet: true });
              next();
            }}
          />
        </Card>
      )}

      {step === 1 && (
        <Card>
          <T variant="h2">What are you studying?</T>
          <T color="textSecondary">Add a few courses or subjects. Skip if you’d rather add them later.</T>
          {courses.map((co) => (
            <ListRow key={co.id} title={co.title} subtitle={co.code ?? undefined} left={<View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: co.color }} />} />
          ))}
          <Field label="Course title" value={courseTitle} onChangeText={setCourseTitle} placeholder="e.g. Data Structures" maxLength={100} />
          <Field label="Code (optional)" value={courseCode} onChangeText={setCourseCode} placeholder="e.g. CSC 205" maxLength={20} />
          <Button
            label="Add course"
            variant="secondary"
            disabled={!courseTitle.trim()}
            onPress={async () => {
              await run((s, ctx) => saveCourse(s, { title: courseTitle.trim(), code: courseCode.trim() || null, color: courseColors[courses.length % courseColors.length]! }, ctx), { quiet: true });
              setCourseTitle('');
              setCourseCode('');
            }}
          />
          <Button label={courses.length ? 'Continue' : 'Skip for now'} onPress={next} variant={courses.length ? 'primary' : 'ghost'} />
        </Card>
      )}

      {step === 2 && (
        <Card>
          <T variant="h2">What’s coming up?</T>
          <T color="textSecondary">Add one upcoming task with its real deadline. You can break it into steps later.</T>
          {tasks.map((t) => (
            <ListRow key={t.id} title={t.title} subtitle={`${formatMinutes(t.estimatedMinutes)}`} />
          ))}
          <Field label="Task" value={taskTitle} onChangeText={setTaskTitle} placeholder="e.g. Linked list assignment" maxLength={140} />
          {courses.length > 0 && <Choice label="Course" value={taskCourse ?? ''} options={[{ value: '', label: 'None' }, ...courses.map((co) => ({ value: co.id, label: co.code ?? co.title }))]} onChange={(v) => setTaskCourse(v || null)} />}
          <DatePick label="Due date" today={today} value={due} onChange={setDue} />
          <TimePick label="Due time" value={dueTime} onChange={setDueTime} />
          <Choice label="Roughly how much work?" value={effort} options={[30, 60, 120, 180, 300].map((m) => ({ value: m, label: formatMinutes(m) }))} onChange={setEffort} />
          <Button
            label="Add task"
            variant="secondary"
            disabled={!taskTitle.trim()}
            onPress={async () => {
              const tzNow = prefs.timezone;
              await run((s, ctx) => createTask(s, { title: taskTitle.trim(), kind: 'assignment', courseId: taskCourse, estimatedMinutes: effort, dueAt: new Date(instantAt(due, dueTime, tzNow)).toISOString(), importance: 3 }, ctx), { quiet: true });
              setTaskTitle('');
            }}
          />
          <Button label={tasks.length ? 'Continue' : 'Skip for now'} onPress={next} variant={tasks.length ? 'primary' : 'ghost'} />
        </Card>
      )}

      {step === 3 && (
        <Card>
          <T variant="h2">When can you study?</T>
          <T color="textSecondary">Add the windows you can usually use. NextStep only plans inside these.</T>
          {windows.map((w) => (
            <ListRow key={w.id} title={`${WEEKDAYS[w.weekday]} ${w.start}–${w.end}`} subtitle={w.online ? 'Usually online' : 'Usually offline'} />
          ))}
          <WeekdayPick label="Days" value={days} onChange={setDays} />
          <TimePick label="From" value={from} onChange={(v) => setFrom(v)} />
          <TimePick label="To" value={to} onChange={setTo} min={from} />
          <Choice label="Do you usually have internet then?" value={online ? 'yes' : 'no'} options={[{ value: 'yes', label: 'Usually yes' }, { value: 'no', label: 'Usually no' }]} onChange={(v) => setOnline(v === 'yes')} />
          <Button
            label="Add window"
            variant="secondary"
            disabled={days.length === 0}
            onPress={async () => {
              for (const weekday of days) await run((s, ctx) => saveAvailability(s, { weekday, start: from, end: to, online }, ctx), { quiet: true });
            }}
          />
          <Button label={windows.length ? 'Continue' : 'Skip for now'} onPress={next} variant={windows.length ? 'primary' : 'ghost'} />
          {!windows.length && <T variant="caption" color="textMuted">Without study windows NextStep can’t place sessions yet — you can add them any time in Plan.</T>}
        </Card>
      )}

      {step === 4 && (
        <Card>
          <T variant="h2">What’s fixed in your week?</T>
          <T color="textSecondary">Work, lectures, commute and rest. NextStep never plans over these. Rest and family time are protected.</T>
          {commitments.map((co) => (
            <ListRow key={co.id} title={co.title} subtitle={`${co.weekdays.map((d) => WEEKDAYS[d]).join(', ')} · ${co.start}–${co.end}${co.protected ? ' · protected' : ''}`} />
          ))}
          <Choice label="Type" value={cKind} options={[{ value: 'work', label: 'Work' }, { value: 'class', label: 'Lectures' }, { value: 'commute', label: 'Commute' }, { value: 'family', label: 'Family' }, { value: 'rest', label: 'Rest' }]} onChange={(v) => { setCKind(v); setCTitle({ work: 'Work', class: 'Lectures', commute: 'Commute', family: 'Family time', rest: 'Rest' }[v]); }} />
          <Field label="Name" value={cTitle} onChangeText={setCTitle} maxLength={80} />
          <WeekdayPick label="Days" value={cDays} onChange={setCDays} />
          <TimePick label="From" value={cFrom} onChange={setCFrom} />
          <TimePick label="To" value={cTo} onChange={setCTo} min={cFrom} />
          <Button
            label="Add commitment"
            variant="secondary"
            disabled={!cTitle.trim() || cDays.length === 0}
            onPress={async () => {
              await run((s, ctx) => saveCommitment(s, { title: cTitle.trim(), kind: cKind, weekdays: cDays, start: cFrom, end: cTo, protected: cKind === 'rest' || cKind === 'family' }, ctx), { quiet: true });
            }}
          />
          <Button label={commitments.length ? 'Continue' : 'Skip for now'} onPress={next} variant={commitments.length ? 'primary' : 'ghost'} />
        </Card>
      )}

      {step === 5 && (
        <Card>
          <Art xml={sceneSvg('onboardingPlan')} width={260} height={195} />
          <T variant="h2">How do you like to work?</T>
          <Choice label="Preferred session length" value={session} options={[25, 45, 60, 90].map((m) => ({ value: m, label: `${m} min` }))} onChange={setSession} />
          <Choice label="Most study per day" value={limit} options={[60, 120, 180, 240].map((m) => ({ value: m, label: formatMinutes(m) }))} onChange={setLimit} />
          <T variant="small" color="textMuted">A realistic limit leaves room for life. You can change it in Profile → Planning.</T>
          <Button
            label="Build my plan"
            onPress={async () => {
              setError(null);
              try {
                await finish();
              } catch {
                setError('Something went wrong saving your plan. Please try again.');
              }
            }}
          />
        </Card>
      )}

      {step > 0 && (
        <Row>
          <Button label="Back" variant="ghost" small onPress={() => setStep((s) => s - 1)} />
        </Row>
      )}
    </Screen>
  );
}

