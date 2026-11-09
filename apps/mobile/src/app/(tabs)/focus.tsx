import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Coffee, Pause, Play, Square } from '../../ui/icons';
import { formatInstant, formatMinutes, formatTimeOfDay, localDateKey } from '@nextstep/contracts';
import { live } from '@nextstep/engine';
import { useDerived } from '../../lib/derive';
import { timerActions, useApp } from '../../lib/store';
import { breakMs, focusMs, formatClock } from '../../lib/timer';
import { notificationPermission } from '../../lib/notifications';
import { Button, Card, Choice, ListRow, Mascot, Notice, Row, Screen, T } from '../../ui/kit';
import { useTheme } from '../../ui/theme';

function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function Focus() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const { state, timer, startTimer, updateTimer, clearTimer } = useApp();
  const d = useDerived();
  // The clock lives in state (not a bare Date.now() in render): with the React
  // Compiler on, a re-render that reads no changed value returns cached output,
  // which froze the countdown. The value itself always comes from timestamps.
  const [now, setNow] = useState(() => Date.now());
  const [work, setWork] = useState(state?.preferences.defaultSessionMinutes ?? 45);
  const [rest, setRest] = useState(state?.preferences.breakMinutes ?? 10);
  const [pick, setPick] = useState<string | null>(params.sessionId ?? null);

  useEffect(() => {
    if (params.sessionId) setPick(params.sessionId);
  }, [params.sessionId]);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  useEffect(() => {
    setNow(Date.now());
    if (!timer?.runningSince) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    const sub = AppState.addEventListener('change', () => setNow(Date.now()));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [timer?.runningSince, timer?.phase]);

  if (!state || !d) return null;
  const prefs = state.preferences;
  const upcoming = live(state.sessions)
    .filter((s) => s.status === 'planned' && Date.parse(s.endAt) > now - 6 * 3_600_000)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5);
  const chosen = pick ? state.sessions.find((s) => s.id === pick) : undefined;

  const finish = async () => {
    const t = timer;
    const result = await clearTimer();
    if (!result || !t) return;
    router.push({
      pathname: '/checkin',
      params: {
        sessionId: t.sessionId ?? '',
        taskId: t.taskId ?? '',
        focusMinutes: String(result.focusMinutes),
        breaks: String(result.breaks),
        startedAt: String(result.startedAt),
        mode: 'timer',
      },
    });
  };

  if (timer) {
    const f = focusMs(timer, now);
    const b = breakMs(timer, now);
    const inFocus = timer.phase === 'focus';
    const target = (inFocus ? timer.workMinutes : timer.breakMinutes) * 60_000;
    const left = Math.max(0, target - (inFocus ? f : b));
    const over = inFocus && f >= target;
    return (
      <Screen>
        {timer.runningSince && <KeepAwake />}
        <T variant="h1">{inFocus ? 'Focus' : 'Break'}</T>
        <Card tone={inFocus ? 'calm' : 'success'} style={{ alignItems: 'center', gap: 12 }}>
          <Mascot pose={inFocus ? 'focus' : 'rest'} skin={prefs.mascotSkin} accessory={prefs.mascotAccessory} size={110} />
          <T variant="bodyStrong" center>
            {timer.label}
          </T>
          <T variant="display" style={{ fontSize: 56, lineHeight: 64 }}>
            {formatClock(left)}
          </T>
          <T variant="small" color="textSecondary" center>
            {timer.runningSince ? (inFocus ? 'Focus time left' : 'Break time left') : 'Paused'} · {formatMinutes(Math.round(f / 60000))} focused so far
          </T>
          {over && inFocus && <Notice tone="success">Block done. A proper break helps — and earns a small bonus.</Notice>}
          <Row style={{ justifyContent: 'center' }}>
            {timer.runningSince ? (
              <Button label="Pause" variant="secondary" icon={<Pause size={18} color={c.textPrimary} />} onPress={() => void updateTimer(timerActions.pause)} />
            ) : (
              <Button label="Resume" icon={<Play size={18} color={c.textOnPrimary} />} onPress={() => void updateTimer(timerActions.resume)} />
            )}
            {inFocus ? (
              <Button
                label="Take a break"
                variant="secondary"
                icon={<Coffee size={18} color={c.textPrimary} />}
                onPress={() => void updateTimer(timerActions.startBreak)}
              />
            ) : (
              <Button label="Back to focus" variant="secondary" onPress={() => void updateTimer(timerActions.backToFocus)} />
            )}
          </Row>
          <Button label="Finish and check in" variant="ink" icon={<Square size={16} color={c.textInverse} />} onPress={() => void finish()} />
        </Card>
        <T variant="caption" color="textMuted" center>
          The timer is saved with timestamps, so it keeps counting if you switch apps or restart your phone. A timer can’t prove learning — the check-in is
          where you note what you finished.
        </T>
      </Screen>
    );
  }

  return (
    <Screen>
      <T variant="h1">Focus</T>
      <T color="textSecondary">An optional timer. You can also log time without it.</T>
      <Card>
        <T variant="h3">What are you working on?</T>
        {upcoming.length === 0 && (
          <T variant="small" color="textMuted">
            No planned sessions right now. You can still start a free focus block.
          </T>
        )}
        {upcoming.map((s) => {
          const t = d.tasks.get(s.taskId);
          return (
            <ListRow
              key={s.id}
              title={d.labelOf(s) ?? t?.title ?? 'Session'}
              subtitle={`${localDateKey(Date.parse(s.startAt), d.tz) === d.day ? formatTimeOfDay(Date.parse(s.startAt), d.tz) : formatInstant(Date.parse(s.startAt), d.tz)} · ${s.minutes} min${d.labelOf(s) ? ` · ${t?.title}` : ''}`}
              onPress={() => setPick(s.id === pick ? null : s.id)}
              right={
                pick === s.id ? (
                  <T variant="caption" color="primarySoftText">
                    Selected
                  </T>
                ) : null
              }
              accessibilityLabel={`${d.labelOf(s) ?? t?.title}${pick === s.id ? ', selected' : ''}`}
            />
          );
        })}
        <Choice
          label="Focus block"
          value={work}
          options={[15, 25, 45, 60].map((m) => ({
            value: m,
            label: `${m} min`,
          }))}
          onChange={setWork}
        />
        <Choice label="Break" value={rest} options={[5, 10, 15].map((m) => ({ value: m, label: `${m} min` }))} onChange={setRest} />
        <Button
          label="Start"
          icon={<Play size={18} color={c.textOnPrimary} />}
          onPress={async () => {
            await notificationPermission(true);
            const t = chosen ? d.tasks.get(chosen.taskId) : undefined;
            await startTimer({
              sessionId: chosen?.id ?? null,
              taskId: chosen?.taskId ?? null,
              label: chosen ? (d.labelOf(chosen) ?? t?.title ?? 'Focus') : 'Free focus',
              workMinutes: work,
              breakMinutes: rest,
            });
          }}
        />
        <Button
          label="Log time without the timer"
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: '/checkin',
              params: { sessionId: chosen?.id ?? '', mode: 'manual' },
            })
          }
        />
      </Card>
      <View>
        <T variant="caption" color="textMuted">
          Focus time beyond 60 minutes in one session earns no extra XP — rest is part of the plan.
        </T>
      </View>
    </Screen>
  );
}
