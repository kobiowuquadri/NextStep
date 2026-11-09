import { useState } from 'react';
import { router } from 'expo-router';
import { goalCheckin, goalMinutesThisWeek, live, saveGoal } from '@nextstep/engine';
import { useApp } from '../lib/store';
import { Button, Card, Choice, Field, Screen, T, Toggle, XpBar } from '../ui/kit';

type Category = 'reading' | 'exercise' | 'skill' | 'wellbeing' | 'other';

/** One or two personal goals, fitted around academic deadlines. */
export default function Goals() {
  const { state, run } = useApp();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('reading');
  const [weekly, setWeekly] = useState(60);
  const [session, setSession] = useState(20);
  const [schedule, setSchedule] = useState(true);
  if (!state) return null;
  const goals = live(state.goals);
  const ctx = { now: Date.now(), newId: () => '' };
  return (
    <Screen>
      <T variant="h1">Personal goals</T>
      <T color="textSecondary">Something for you — reading, exercise, a career skill. NextStep fits it around deadlines and never lets it crowd out urgent work.</T>
      {goals.map((g) => {
        const done = goalMinutesThisWeek(state, g.id, ctx);
        return (
          <Card key={g.id} tone="calm">
            <T variant="h3">{g.title}</T>
            <XpBar tone="calm" progress={done / g.weeklyTargetMinutes} label={`${done} of ${g.weeklyTargetMinutes} minutes this week`} />
            <T variant="small" color="textSecondary">
              {done} of {g.weeklyTargetMinutes} min this week · {g.scheduleIt ? 'planned around your work' : 'not planned automatically'}
            </T>
            <Button label={`Log ${g.sessionMinutes} min`} small variant="secondary" onPress={() => void run((s, c) => goalCheckin(s, g.id, g.sessionMinutes, null, c), { toast: 'Goal time logged' })} />
            <Toggle label="Active" value={g.active} onChange={(v) => void run((s, c) => saveGoal(s, { ...g, active: v }, c), { quiet: true })} />
          </Card>
        );
      })}
      {goals.filter((g) => g.active).length < 2 ? (
        <Card>
          <T variant="h3">Add a goal</T>
          <Field label="Goal" value={title} onChangeText={setTitle} placeholder="e.g. Read for fun" maxLength={80} />
          <Choice label="Type" value={category} options={[{ value: 'reading', label: 'Reading' }, { value: 'exercise', label: 'Exercise' }, { value: 'skill', label: 'Skill' }, { value: 'wellbeing', label: 'Wellbeing' }, { value: 'other', label: 'Other' }]} onChange={setCategory} />
          <Choice label="Per week" value={weekly} options={[30, 60, 90, 120].map((m) => ({ value: m, label: `${m} min` }))} onChange={setWeekly} />
          <Choice label="Session" value={session} options={[10, 20, 30, 45].map((m) => ({ value: m, label: `${m} min` }))} onChange={setSession} />
          <Toggle label="Plan time for it" hint="Fitted after deadline work, at most once a day" value={schedule} onChange={setSchedule} />
          <Button
            label="Add goal"
            disabled={!title.trim()}
            onPress={async () => {
              await run((s, c) => saveGoal(s, { title: title.trim(), category, weeklyTargetMinutes: weekly, sessionMinutes: session, scheduleIt: schedule }, c), { toast: 'Goal added' });
              setTitle('');
            }}
          />
        </Card>
      ) : (
        <T variant="small" color="textMuted">
          Two active goals keeps things realistic. Pause one to add another.
        </T>
      )}
      <Button label="Done" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
