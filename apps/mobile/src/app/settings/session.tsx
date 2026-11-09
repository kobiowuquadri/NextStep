import { useState } from 'react';
import { router } from 'expo-router';
import { instantAt, localDateKey, parseHHMM } from '@nextstep/contracts';
import { addManualSession, live } from '@nextstep/engine';
import { useApp } from '../../lib/store';
import { Button, Card, Choice, Notice, Screen, T } from '../../ui/kit';
import { DatePick, TimePick } from '../../ui/pickers';

/** Manual planning: place a session yourself. It is pinned, so automatic replans keep it. */
export default function AddSession() {
  const { state, run } = useApp();
  const tz = state?.preferences.timezone ?? 'Africa/Lagos';
  const today = localDateKey(Date.now(), tz);
  const [taskId, setTaskId] = useState('');
  const [date, setDate] = useState(today);
  const [start, setStart] = useState('19:00');
  const [end, setEnd] = useState('20:00');
  if (!state) return null;
  const tasks = live(state.tasks).filter((t) => t.status !== 'done' && t.status !== 'archived');
  const valid = taskId && parseHHMM(end) > parseHHMM(start);
  return (
    <Screen>
      <T variant="h1">Add a session</T>
      <Card>
        {tasks.length === 0 ? <Notice>Add a task first.</Notice> : <Choice label="Task" value={taskId} options={tasks.map((t) => ({ value: t.id, label: t.title }))} onChange={setTaskId} />}
        <DatePick label="Day" today={today} value={date} onChange={setDate} days={21} />
        <TimePick label="Start" value={start} onChange={setStart} />
        <TimePick label="End" value={end} onChange={setEnd} min={start} />
        <Button
          label="Add session"
          disabled={!valid}
          onPress={async () => {
            await run((s, ctx) => addManualSession(s, { taskId, startAt: new Date(instantAt(date, start, tz)).toISOString(), endAt: new Date(instantAt(date, end, tz)).toISOString() }, ctx), { toast: 'Session added' });
            router.back();
          }}
        />
        <T variant="caption" color="textMuted">
          The Plan tab will flag clashes with commitments, overlaps, and work placed after a deadline.
        </T>
      </Card>
    </Screen>
  );
}
