import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from '../ui/icons';
import { formatMinutes } from '@nextstep/contracts';
import { live, logFocus } from '@nextstep/engine';
import { currentSessionLabels } from '@nextstep/scheduler';
import { useApp } from '../lib/store';
import { Button, Card, Choice, Field, Row, Screen, T } from '../ui/kit';
import { useTheme } from '../ui/theme';

const OBSTACLES = ['Data ran out', 'Power cut', 'Work ran late', 'Too tired', 'Family needed me', 'Hard to focus', 'Topic was confusing'];

/** After a session: what got done, what's left, how ready you feel. Works with or without the timer. */
export default function CheckIn() {
  const { c } = useTheme();
  const p = useLocalSearchParams<{
    sessionId?: string;
    taskId?: string;
    focusMinutes?: string;
    breaks?: string;
    startedAt?: string;
    mode?: 'timer' | 'manual';
  }>();
  const { state, run } = useApp();
  const session = p.sessionId ? state?.sessions.find((s) => s.id === p.sessionId) : undefined;
  // The step this session is for: open steps mapped onto the task's sessions from this one on.
  const labelMap = session && state ? currentSessionLabels(live(state.sessions), live(state.subtasks), Date.parse(session.startAt)) : null;
  const sessionLabel = session ? (labelMap?.has(session.id) ? labelMap.get(session.id)! : (session.label ?? null)) : null;
  const taskIdInit = session?.taskId ?? (p.taskId || null);
  const [taskId, setTaskId] = useState<string | null>(taskIdInit);
  const task = taskId ? state?.tasks.find((t) => t.id === taskId) : undefined;
  const subtasks = state
    ? live(state.subtasks)
        .filter((s) => s.taskId === taskId && !s.done)
        .sort((a, b) => a.position - b.position)
    : [];
  const [minutes, setMinutes] = useState(p.focusMinutes ? Number(p.focusMinutes) : (session?.minutes ?? 30));
  const [done, setDone] = useState<string[]>(() => subtasks.filter((s) => s.title === sessionLabel).map((s) => s.id));
  const [note, setNote] = useState('');
  const [remaining, setRemaining] = useState(
    String(Math.max(0, (task?.remainingMinutes ?? 0) - (p.focusMinutes ? Number(p.focusMinutes) : (session?.minutes ?? 30)))),
  );
  // The suggestion follows the chosen focus time until the student types their own number.
  const [remainingEdited, setRemainingEdited] = useState(false);
  const chooseMinutes = (m: number) => {
    setMinutes(m);
    if (!remainingEdited) setRemaining(String(Math.max(0, (task?.remainingMinutes ?? 0) - m)));
  };
  const [ready, setReady] = useState<'ready' | 'more_practice' | 'unsure' | ''>('');
  const [obstacles, setObstacles] = useState<string[]>([]);
  const [breakTaken, setBreakTaken] = useState((p.breaks ? Number(p.breaks) : 0) > 0);
  if (!state) return null;
  const openTasks = live(state.tasks).filter((t) => t.status !== 'done' && !t.goalId);

  const save = async () => {
    const end = Date.now();
    const start = p.startedAt ? Number(p.startedAt) : end - minutes * 60_000;
    await run(
      (s, ctx) =>
        logFocus(
          s,
          {
            taskId,
            sessionId: session?.id ?? null,
            mode: p.mode === 'timer' ? 'timer' : 'manual',
            startedAt: new Date(start).toISOString(),
            endedAt: new Date(end).toISOString(),
            focusMinutes: minutes,
            breakCount: breakTaken ? 1 : 0,
            finishedNote: note.trim() || null,
            remainingMinutes: task ? Math.max(0, Number(remaining) || 0) : null,
            readiness: ready || null,
            obstacles,
            completedSubtaskIds: done,
          },
          ctx,
        ),
      { toast: 'Session logged' },
    );
    router.back();
  };

  return (
    <Screen>
      <T variant="h1">Check in</T>
      <T color="textSecondary">
        {session ? `${sessionLabel ?? task?.title} · planned ${formatMinutes(session.minutes)}` : 'Log focus time, with or without the timer.'}
      </T>
      {!session && (
        <Card flat>
          <Choice
            label="Task (optional)"
            value={taskId ?? ''}
            options={[{ value: '', label: 'No task' }, ...openTasks.map((t) => ({ value: t.id, label: t.title }))]}
            onChange={(v) => setTaskId(v || null)}
          />
        </Card>
      )}
      <Card>
        <Choice
          label="How long did you focus?"
          value={minutes}
          options={[...new Set([10, 20, 30, 45, 60, minutes])].sort((a, b) => a - b).map((m) => ({ value: m, label: `${m} min` }))}
          onChange={chooseMinutes}
        />
        {subtasks.length > 0 && (
          <View style={{ gap: 8 }}>
            <T variant="small" weight="700">
              What did you finish?
            </T>
            {subtasks.map((s) => {
              const on = done.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setDone((d) => (on ? d.filter((x) => x !== s.id) : [...d, s.id]))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={s.title}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    minHeight: 48,
                  }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: c.borderStrong,
                      backgroundColor: on ? c.success : c.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on && <Check size={16} color={c.textOnAccent} />}
                  </View>
                  <T style={{ flex: 1 }}>{s.title}</T>
                </Pressable>
              );
            })}
          </View>
        )}
        <Field label="Anything else you finished? (optional)" value={note} onChangeText={setNote} maxLength={200} />
        {task && (
          <Field
            label="How much work is left on this task? (minutes)"
            value={remaining}
            onChangeText={(v) => {
              setRemainingEdited(true);
              setRemaining(v.replace(/[^0-9]/g, ''));
            }}
            keyboardType="number-pad"
            hint="0 marks the task complete."
          />
        )}
        <Choice
          label="Ready to move on, or need more practice?"
          value={ready}
          options={[
            { value: 'ready', label: 'Ready' },
            { value: 'more_practice', label: 'More practice' },
            { value: 'unsure', label: 'Not sure' },
          ]}
          onChange={setReady}
        />
        <T variant="caption" color="textMuted">
          This is your own sense of readiness, not a measure of mastery.
        </T>
        <View style={{ gap: 8 }}>
          <T variant="small" weight="700">
            Anything get in the way? (optional)
          </T>
          <Row gap={8}>
            {OBSTACLES.map((o) => {
              const on = obstacles.includes(o);
              return (
                <Pressable
                  key={o}
                  onPress={() => setObstacles((xs) => (on ? xs.filter((x) => x !== o) : [...xs, o]))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    borderWidth: 2,
                    borderColor: c.borderStrong,
                    backgroundColor: on ? c.primary : c.surface,
                    justifyContent: 'center',
                  }}
                >
                  <T variant="small" weight="700" style={{ color: on ? c.textOnPrimary : c.textPrimary }}>
                    {o}
                  </T>
                </Pressable>
              );
            })}
          </Row>
        </View>
        <Choice
          label="Did you take a proper break?"
          value={breakTaken ? 'yes' : 'no'}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'Not yet' },
          ]}
          onChange={(v) => setBreakTaken(v === 'yes')}
        />
        <Button label="Save check-in" onPress={() => void save()} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}
