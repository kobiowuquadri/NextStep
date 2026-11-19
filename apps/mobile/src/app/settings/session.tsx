import { useState } from 'react';
import { router } from 'expo-router';
import { instantAt, localDateKey, parseHHMM } from '@nextstep/contracts';
import { addManualSession, live } from '@nextstep/engine';
import { useApp } from '../../lib/store';
import { Button, Card, Notice, Screen, T } from '../../ui/kit';
import { SelectField } from '../../ui/forms';
import { DatePick, TimeRangePick } from '../../ui/pickers';

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
        {tasks.length === 0 ? <Notice>Add a task first, then place its sessions here.</Notice> : <SelectField label="Task" value={taskId || null} placeholder="Choose a task" options={tasks.map((t) => ({ value: t.id, label: t.title }))} onChange={setTaskId} />}
        <DatePick label="Day" today={today} value={date} onChange={setDate} days={21} />
        <TimeRangePick
          from={start}
          to={end}
          fromLabel="Start"
          toLabel="End"
          onChange={(f, t) => {
            setStart(f);
            setEnd(t);
          }}
        />
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
