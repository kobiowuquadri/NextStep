import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { formatMinutes, localDateKey, weekStartOfKey } from '@nextstep/contracts';
import { live, saveReflection, weeklySummary } from '@nextstep/engine';
import { useApp } from '../lib/store';
import { Button, Card, Field, Mascot, Notice, Row, Screen, SectionLabel, T } from '../ui/kit';
import { useTheme } from '../ui/theme';

const OBSTACLES = ['Work shifts', 'Commute', 'Data', 'Power', 'Health', 'Family', 'Motivation', 'Unclear tasks'];

export default function Reflection() {
  const { c } = useTheme();
  const { state, run } = useApp();
  const [wentWell, setWentWell] = useState('');
  const [obstacles, setObstacles] = useState<string[]>([]);
  const [note, setNote] = useState('');
  if (!state) return null;
  const weekStart = weekStartOfKey(localDateKey(Date.now(), state.preferences.timezone));
  const s = weeklySummary(state, weekStart, Date.now());
  const saved = live(state.reflections).find((r) => r.weekStart === weekStart);
  const stat = (label: string, value: string) => (
    <View style={{ flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: 14, backgroundColor: c.surfaceSubtle }}>
      <T variant="caption" color="textMuted">
        {label}
      </T>
      <T variant="h2">{value}</T>
    </View>
  );
  return (
    <Screen>
      <Row style={{ flexWrap: 'nowrap' }}>
        <Mascot pose="thinking" size={72} />
        <View style={{ flex: 1 }}>
          <T variant="h1">This week</T>
          <T variant="small" color="textMuted">
            Look back, plan forward. No scores, no judgement.
          </T>
        </View>
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {stat('Planned', formatMinutes(s.plannedMinutes))}
        {stat('Done (sessions)', formatMinutes(s.completedMinutes))}
        {stat('Logged focus', formatMinutes(s.actualMinutes))}
        {stat('Restarts', String(s.restarts))}
      </View>
      {s.tasksCompleted.length > 0 && (
        <Card flat>
          <T variant="bodyStrong">Estimated vs actual</T>
          {s.tasksCompleted.map((t) => (
            <T key={t.id} variant="small">
              • {t.title}: estimated {formatMinutes(t.estimated)}, logged {formatMinutes(t.actual)}
            </T>
          ))}
        </Card>
      )}
      {s.needsAttention.length > 0 && (
        <Card tone="danger" flat>
          <T variant="bodyStrong">Needs attention</T>
          {s.needsAttention.map((t) => (
            <T key={t.id} variant="small">
              • {t.title}: {t.reason}
            </T>
          ))}
        </Card>
      )}
      <SectionLabel>Suggestions for next week</SectionLabel>
      {s.suggestions.map((x) => (
        <Notice key={x}>{x}</Notice>
      ))}
      <T variant="caption" color="textMuted">
        Logged activity shows what you did, not how much you learned or your grades.
      </T>
      {saved ? (
        <Card tone="success" flat>
          <T variant="bodyStrong">Reflection saved for this week.</T>
          {saved.wentWell ? <T variant="small">Went well: {saved.wentWell}</T> : null}
        </Card>
      ) : (
        <Card>
          <Field label="What went well?" value={wentWell} onChangeText={setWentWell} multiline maxLength={1000} />
          <T variant="small" weight="700">
            What got in the way?
          </T>
          <Row gap={8}>
            {OBSTACLES.map((o) => {
              const on = obstacles.includes(o);
              return (
                <Pressable key={o} onPress={() => setObstacles((xs) => (on ? xs.filter((x) => x !== o) : [...xs, o]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: on ? c.primary : c.surface, justifyContent: 'center' }}>
                  <T variant="small" weight="700" style={{ color: on ? c.textOnPrimary : c.textPrimary }}>
                    {o}
                  </T>
                </Pressable>
              );
            })}
          </Row>
          <Field label="Anything else? (optional)" value={note} onChangeText={setNote} multiline maxLength={1000} />
          <Button
            label="Save reflection"
            onPress={async () => {
              await run((st, ctx) => saveReflection(st, { weekStart, wentWell: wentWell.trim() || null, obstacles, adjustments: s.suggestions.slice(0, 3), note: note.trim() || null }, { plannedMinutes: s.plannedMinutes, completedMinutes: s.completedMinutes, estimatedMinutes: s.estimatedMinutes, actualMinutes: s.actualMinutes }, ctx), { toast: 'Reflection saved' });
            }}
          />
        </Card>
      )}
      <Button label="Done" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
