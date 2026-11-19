import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { courseColors } from '@nextstep/design-tokens';
import { formatMinutes, instantAt, isValidTimezone, localDateKey, addDaysToKey, type TaskKind } from '@nextstep/contracts';
import { createTask, generatePlanAction, saveAvailability, saveCommitment, saveCourse, updatePreferences, live, type ActionError, type ActionResult, type AppState, type Ctx } from '@nextstep/engine';
import { sceneSvg } from '@nextstep/illustrations';
import { useApp } from '../lib/store';
import { deviceTimezone, WEEKDAYS } from '../lib/format';
import { COMMITMENT_NAMES, COURSE_IDEAS, INSTITUTIONS, KIND_LABEL, taskTitleIdeas, timezoneOptions } from '../lib/suggestions';
import { Art, Button, Card, Choice, Field, ListRow, Notice, Row, Screen, T } from '../ui/kit';
import { ChoiceOrSelect, DurationPick, SelectField, SuggestField } from '../ui/forms';
import { DatePick, TimePick, TimeRangePick, WeekdayPick } from '../ui/pickers';
import { useTheme } from '../ui/theme';

const STEPS = ['You', 'Courses', 'A task', 'Study time', 'Fixed commitments', 'Session length'] as const;
type CommitmentKind = 'work' | 'class' | 'commute' | 'family' | 'rest';
const ONBOARDING_KINDS: TaskKind[] = ['assignment', 'exam', 'reading', 'project', 'revision'];

export default function Onboarding() {
  const { state, run } = useApp();
  const { c } = useTheme();
  const [step, setStep] = useState(0);
  const prefs = state?.preferences;
  const today = prefs ? localDateKey(Date.now(), prefs.timezone) : '';
  // step 0
  const [name, setName] = useState(prefs?.displayName ?? '');
  const [tz, setTz] = useState(prefs?.timezone && isValidTimezone(prefs.timezone) ? prefs.timezone : deviceTimezone());
  const [school, setSchool] = useState(prefs?.institution ?? '');
  // step 1
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  // step 2
  const [taskKind, setTaskKind] = useState<TaskKind>('assignment');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCourse, setTaskCourse] = useState('');
  const [due, setDue] = useState(addDaysToKey(today || '2026-01-01', 5));
  const [dueTime, setDueTime] = useState('18:00');
  const [effort, setEffort] = useState(120);
  // step 3
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [from, setFrom] = useState('19:00');
  const [to, setTo] = useState('21:30');
  const [online, setOnline] = useState(true);
  // step 4
  const [cKind, setCKind] = useState<CommitmentKind>('work');
  const [cTitle, setCTitle] = useState('Work');
  const [cDays, setCDays] = useState<number[]>([1, 3, 5]);
  const [cFrom, setCFrom] = useState('09:00');
  const [cTo, setCTo] = useState('17:00');
  // step 5
  const [session, setSession] = useState(prefs?.defaultSessionMinutes ?? 45);
  const [limit, setLimit] = useState(prefs?.dailyLimitMinutes ?? 180);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!state || !prefs) return null;
  const courses = live(state.courses);
  const tasks = live(state.tasks).filter((t) => !t.goalId);
  const windows = live(state.availability);
  const commitments = live(state.commitments);
  const go = (to: number) => {
    setError(null);
    setStep(Math.max(0, Math.min(STEPS.length - 1, to)));
  };
  const next = () => go(step + 1);

  /** Runs one change; shows a plain message instead of failing silently. */
  const save = async (fn: (s: AppState, ctx: Ctx) => ActionResult | ActionError, what: string): Promise<boolean> => {
    const r = await run(fn, { quiet: true });
    if ('error' in r) {
      setError(`Couldn’t save ${what}. Check the details and try again.`);
      return false;
    }
    return true;
  };

  const addCourse = async () => {
    if (!courseTitle.trim()) return true;
    const ok = await save((s, ctx) => saveCourse(s, { title: courseTitle.trim(), code: courseCode.trim().toUpperCase() || null, color: courseColors[courses.length % courseColors.length]! }, ctx), 'the course');
    if (ok) {
      setCourseTitle('');
      setCourseCode('');
    }
    return ok;
  };
  const addTask = async () => {
    if (!taskTitle.trim()) return true;
    const tzNow = prefs.timezone;
    const ok = await save(
      (s, ctx) => createTask(s, { title: taskTitle.trim(), kind: taskKind, courseId: taskCourse || null, estimatedMinutes: effort, dueAt: new Date(instantAt(due, dueTime, tzNow)).toISOString(), importance: 3 }, ctx),
      'the task',
    );
    if (ok) setTaskTitle('');
    return ok;
  };
  const addWindows = async () => {
    for (const weekday of days) if (!(await save((s, ctx) => saveAvailability(s, { weekday, start: from, end: to, online }, ctx), 'these study times'))) return false;
    return true;
  };
  const addCommitment = async () =>
    save((s, ctx) => saveCommitment(s, { title: cTitle.trim(), kind: cKind, weekdays: cDays, start: cFrom, end: cTo, protected: cKind === 'rest' || cKind === 'family' }, ctx), 'this commitment');

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await run((s, ctx) => updatePreferences(s, { defaultSessionMinutes: session, dailyLimitMinutes: limit, maxSessionMinutes: Math.max(session, 90) }, ctx), { quiet: true });
      await run((s, ctx) => generatePlanAction(s, ctx).result, { batch: true, basePlanRevision: 0, toast: 'Your first plan is ready' });
      await run((s, ctx) => updatePreferences(s, { onboardingCompletedAt: new Date(ctx.now).toISOString() }, ctx), { quiet: true });
      router.replace('/(tabs)');
    } catch {
      setError('Something went wrong saving your plan. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const selectedCourse = courses.find((co) => co.id === taskCourse);

  return (
    // A new key per step starts each step at the top of the screen.
    <Screen key={step}>
      <View style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <T variant="label" color="primarySoftText">
            STEP {step + 1} OF {STEPS.length} · {STEPS[step]!.toUpperCase()}
          </T>
          {step > 0 && <Button label="Back" variant="ghost" small onPress={() => go(step - 1)} />}
        </Row>
        <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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
          <Field label="What should we call you?" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" autoComplete="name" returnKeyType="done" />
          <SelectField label="Timezone" value={tz} options={timezoneOptions(deviceTimezone(), prefs.timezone)} onChange={setTz} searchPlaceholder="Search by city" hint="Plans and reminders use this. It’s taken from your phone." />
          <SuggestField label="School or programme (optional)" value={school} onChangeText={setSchool} suggestions={INSTITUTIONS} max={6} maxLength={120} placeholder="Start typing your school" autoCapitalize="words" />
          <Button
            label="Continue"
            disabled={!name.trim() || !isValidTimezone(tz)}
            onPress={async () => {
              if (await save((s, ctx) => updatePreferences(s, { displayName: name.trim(), timezone: tz, institution: school.trim() || null }, ctx), 'your details')) next();
            }}
          />
          {!name.trim() && (
            <T variant="caption" color="textMuted">
              Add a name to continue. It’s only shown to you.
            </T>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card>
          <T variant="h2">What are you studying?</T>
          <T color="textSecondary">Add the courses you’re taking this term. Tasks can be linked to them later.</T>
          {courses.map((co) => (
            <ListRow key={co.id} title={co.title} subtitle={co.code ?? undefined} left={<View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: co.color }} />} />
          ))}
          <SuggestField label={courses.length ? 'Another course' : 'Course title'} value={courseTitle} onChangeText={setCourseTitle} suggestions={COURSE_IDEAS} max={6} placeholder="e.g. Data Structures" maxLength={100} autoCapitalize="words" />
          <Field label="Course code (optional)" value={courseCode} onChangeText={setCourseCode} placeholder="e.g. CSC 205" maxLength={20} autoCapitalize="characters" />
          {courseTitle.trim() ? (
            <>
              <Button label="Save course and continue" onPress={async () => (await addCourse()) && next()} />
              <Button label="Save and add another" variant="secondary" onPress={() => void addCourse()} />
            </>
          ) : courses.length ? (
            <Button label="Continue" onPress={next} />
          ) : (
            <Button label="Skip for now" variant="ghost" onPress={next} />
          )}
        </Card>
      )}

      {step === 2 && (
        <Card>
          <T variant="h2">What’s coming up?</T>
          <T color="textSecondary">Add one task with its real deadline. NextStep plans study sessions before it.</T>
          {tasks.map((t) => (
            <ListRow key={t.id} title={t.title} subtitle={`${KIND_LABEL[t.kind]} · ${formatMinutes(t.estimatedMinutes)}`} />
          ))}
          <Choice label="Type" value={taskKind} options={ONBOARDING_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} onChange={setTaskKind} />
          {courses.length > 0 && <ChoiceOrSelect label="Course" value={taskCourse} options={[{ value: '', label: 'No course' }, ...courses.map((co) => ({ value: co.id, label: co.code ?? co.title, hint: co.code ? co.title : undefined }))]} onChange={setTaskCourse} />}
          <SuggestField label="Task" value={taskTitle} onChangeText={setTaskTitle} suggestions={taskTitleIdeas(taskKind, selectedCourse?.code)} max={4} placeholder="e.g. Linked list assignment" maxLength={140} />
          <DatePick label="Due date" today={today} value={due} onChange={setDue} />
          <TimePick label="Due time" value={dueTime} onChange={setDueTime} />
          <DurationPick label="Roughly how much work?" value={effort} onChange={setEffort} presets={[30, 60, 120, 180, 300]} hint="A rough guess is fine. You can change it after each session." />
          {taskTitle.trim() ? (
            <>
              <Button label="Save task and continue" onPress={async () => (await addTask()) && next()} />
              <Button label="Save and add another" variant="secondary" onPress={() => void addTask()} />
            </>
          ) : tasks.length ? (
            <Button label="Continue" onPress={next} />
          ) : (
            <Button label="Skip for now" variant="ghost" onPress={next} />
          )}
        </Card>
      )}

      {step === 3 && (
        <Card>
          <T variant="h2">When can you study?</T>
          <T color="textSecondary">Pick the days and times you can usually study. NextStep only plans inside these.</T>
          {windows.map((w) => (
            <ListRow key={w.id} title={`${WEEKDAYS[w.weekday]} ${w.start}–${w.end}`} subtitle={w.online ? 'Usually online' : 'Usually offline'} />
          ))}
          <WeekdayPick label="Days" value={days} onChange={setDays} />
          <TimeRangePick
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
            }}
          />
          <Choice label="Do you usually have internet then?" value={online ? 'yes' : 'no'} options={[{ value: 'yes', label: 'Usually yes' }, { value: 'no', label: 'Usually no' }]} onChange={(v) => setOnline(v === 'yes')} />
          {windows.length === 0 ? (
            <>
              <Button label="Save these times and continue" disabled={days.length === 0} onPress={async () => (await addWindows()) && next()} />
              <Button label="Skip for now" variant="ghost" onPress={next} />
              <T variant="caption" color="textMuted">
                Without study times NextStep can’t place sessions yet. You can add them any time from Plan.
              </T>
            </>
          ) : (
            <>
              <Button label="Continue" onPress={next} />
              <Button label="Add these times too" variant="secondary" disabled={days.length === 0} onPress={() => void addWindows()} />
            </>
          )}
        </Card>
      )}

      {step === 4 && (
        <Card>
          <T variant="h2">What’s fixed in your week?</T>
          <T color="textSecondary">Work, lectures, commute and rest. NextStep never plans over these, and rest and family time are protected.</T>
          {commitments.map((co) => (
            <ListRow key={co.id} title={co.title} subtitle={`${co.weekdays.map((d) => WEEKDAYS[d]).join(', ')} · ${co.start}–${co.end}${co.protected ? ' · protected' : ''}`} />
          ))}
          <Choice
            label="Type"
            value={cKind}
            options={(['work', 'class', 'commute', 'family', 'rest'] as const).map((k) => ({ value: k, label: k === 'class' ? 'Lectures' : k === 'family' ? 'Family' : COMMITMENT_NAMES[k] }))}
            onChange={(v) => {
              setCKind(v);
              setCTitle(COMMITMENT_NAMES[v]);
            }}
          />
          <Field label="Name" value={cTitle} onChangeText={setCTitle} maxLength={80} autoCapitalize="sentences" />
          <WeekdayPick label="Days" value={cDays} onChange={setCDays} />
          <TimeRangePick
            from={cFrom}
            to={cTo}
            onChange={(f, t) => {
              setCFrom(f);
              setCTo(t);
            }}
          />
          {commitments.length === 0 ? (
            <>
              <Button label="Save and continue" disabled={!cTitle.trim() || cDays.length === 0} onPress={async () => (await addCommitment()) && next()} />
              <Button label="Skip — nothing fixed" variant="ghost" onPress={next} />
            </>
          ) : (
            <>
              <Button label="Continue" onPress={next} />
              <Button label="Add this one too" variant="secondary" disabled={!cTitle.trim() || cDays.length === 0} onPress={() => void addCommitment()} />
            </>
          )}
        </Card>
      )}

      {step === 5 && (
        <Card>
          <Art xml={sceneSvg('onboardingPlan')} width={260} height={195} />
          <T variant="h2">How do you like to work?</T>
          <Choice label="Preferred session length" value={session} options={[25, 45, 60, 90].map((m) => ({ value: m, label: `${m} min` }))} onChange={setSession} />
          <Choice label="Most study per day" value={limit} options={[60, 120, 180, 240].map((m) => ({ value: m, label: formatMinutes(m) }))} onChange={setLimit} />
          <T variant="small" color="textMuted">
            A realistic limit leaves room for life. You can change both later in Profile → Planning.
          </T>
          <Button label="Build my plan" loading={busy} onPress={() => void finish()} />
        </Card>
      )}
    </Screen>
  );
}
