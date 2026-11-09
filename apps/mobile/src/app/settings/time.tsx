import { useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Trash2 } from '../../ui/icons';
import { currentRevision, deleteRecord, generatePlanAction, live, saveAvailability, saveCommitment, type ActionResult } from '@nextstep/engine';
import { useApp } from '../../lib/store';
import { WEEKDAYS } from '../../lib/format';
import { Button, Card, Choice, Field, ListRow, Screen, SectionLabel, T } from '../../ui/kit';
import { TimePick, WeekdayPick } from '../../ui/pickers';
import { useTheme } from '../../ui/theme';

type Kind = 'work' | 'class' | 'commute' | 'family' | 'rest' | 'worship' | 'other';

export default function TimeSettings() {
  const { c } = useTheme();
  const { state, run } = useApp();
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [from, setFrom] = useState('19:00');
  const [to, setTo] = useState('21:00');
  const [online, setOnline] = useState(true);
  const [kind, setKind] = useState<Kind>('work');
  const [title, setTitle] = useState('Work');
  const [cDays, setCDays] = useState<number[]>([1, 3, 5]);
  const [cFrom, setCFrom] = useState('09:00');
  const [cTo, setCTo] = useState('17:00');
  if (!state) return null;
  const windows = live(state.availability).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  const commitments = live(state.commitments);
  const remove = (entity: 'availability' | 'commitment', id: string) => (
    <Pressable onPress={() => void run((s, ctx) => deleteRecord(s, entity, id, ctx), { toast: 'Removed' })} accessibilityRole="button" accessibilityLabel="Remove" hitSlop={10} style={{ padding: 6 }}>
      <Trash2 size={18} color={c.textMuted} />
    </Pressable>
  );
  const replan = () => run((s, ctx) => generatePlanAction(s, ctx).result as ActionResult, { batch: true, basePlanRevision: currentRevision(state), toast: 'Plan updated for your new times' });

  return (
    <Screen>
      <T variant="h1">Study time</T>
      <T color="textSecondary">NextStep only plans inside your study windows and never over fixed commitments or protected rest.</T>
      <SectionLabel>Study windows</SectionLabel>
      {windows.length === 0 && <T color="textMuted">No windows yet.</T>}
      {windows.map((w) => (
        <ListRow key={w.id} title={`${WEEKDAYS[w.weekday]} ${w.start}–${w.end}`} subtitle={w.online ? 'Usually online' : 'Usually offline'} right={remove('availability', w.id)} />
      ))}
      <Card>
        <WeekdayPick label="Days" value={days} onChange={setDays} />
        <TimePick label="From" value={from} onChange={setFrom} />
        <TimePick label="To" value={to} onChange={setTo} min={from} />
        <Choice label="Internet in this window?" value={online ? 'yes' : 'no'} options={[{ value: 'yes', label: 'Usually yes' }, { value: 'no', label: 'Usually no' }]} onChange={(v) => setOnline(v === 'yes')} />
        <Button label="Add window" variant="secondary" disabled={!days.length} onPress={async () => { for (const weekday of days) await run((s, ctx) => saveAvailability(s, { weekday, start: from, end: to, online }, ctx), { quiet: true }); }} />
      </Card>

      <SectionLabel>Fixed commitments</SectionLabel>
      {commitments.map((co) => (
        <ListRow key={co.id} title={co.title} subtitle={`${co.date ?? co.weekdays.map((d) => WEEKDAYS[d]).join(', ')} · ${co.start}–${co.end}${co.protected ? ' · protected' : ''}`} right={remove('commitment', co.id)} />
      ))}
      <Card>
        <Choice label="Type" value={kind} options={[{ value: 'work', label: 'Work' }, { value: 'class', label: 'Lectures' }, { value: 'commute', label: 'Commute' }, { value: 'family', label: 'Family' }, { value: 'rest', label: 'Rest' }, { value: 'worship', label: 'Worship' }, { value: 'other', label: 'Other' }]} onChange={(v) => { setKind(v); setTitle({ work: 'Work', class: 'Lectures', commute: 'Commute', family: 'Family time', rest: 'Rest', worship: 'Worship', other: 'Commitment' }[v]); }} />
        <Field label="Name" value={title} onChangeText={setTitle} maxLength={80} />
        <WeekdayPick label="Days" value={cDays} onChange={setCDays} />
        <TimePick label="From" value={cFrom} onChange={setCFrom} />
        <TimePick label="To" value={cTo} onChange={setCTo} min={cFrom} />
        <Button label="Add commitment" variant="secondary" disabled={!title.trim() || !cDays.length} onPress={() => void run((s, ctx) => saveCommitment(s, { title: title.trim(), kind, weekdays: cDays, start: cFrom, end: cTo, protected: kind === 'rest' || kind === 'family' || kind === 'worship' }, ctx), { toast: 'Commitment added' })} />
      </Card>
      {state.preferences.planningMode === 'auto' && <Button label="Replan with these times" onPress={() => void replan()} />}
      <Button label="Done" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
