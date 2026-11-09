import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, RefreshControl, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BookHeart, Plus, Shuffle, Sparkles, Timer } from '../../ui/icons';
import { formatInstant, formatMinutes, formatTimeOfDay, relativeDay } from '@nextstep/contracts';
import { goalCheckin, goalMinutesThisWeek, live, markSessionMissed, toPlannerInput } from '@nextstep/engine';
import { sceneSvg } from '@nextstep/illustrations';
import { optionalExtra } from '@nextstep/scheduler';
import { useDerived } from '../../lib/derive';
import { useApp } from '../../lib/store';
import { Button, Card, Dot, Empty, ListRow, Mascot, Row, Screen, SectionLabel, StatusChip, T, XpBar } from '../../ui/kit';
import { SyncBadge } from '../../ui/SyncBadge';
import { useTheme } from '../../ui/theme';

function greeting(hour: number) {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const { c } = useTheme();
  const { state, run, syncNow, account, sync } = useApp();
  // Clock in state so the React Compiler re-renders the greeting and "now"-based
  // values each minute and when the app returns to the foreground.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  const d = useDerived(now);
  if (!state || !d) return null;
  const prefs = state.preferences;
  const hour = Number(formatTimeOfDay(now, d.tz).slice(0, 2));
  const next = d.today.actions[0];
  const later = d.today.actions.slice(1);
  const nextTask = next ? d.tasks.get(next.taskId) : undefined;
  const goal = live(state.goals).find((g) => g.active);
  const goalDone = goal ? goalMinutesThisWeek(state, goal.id, { now, newId: () => '' }) : 0;
  const extra = d.today.actions.length === 0 ? optionalExtra(toPlannerInput(state, now)) : null;
  const course = (taskId?: string) => {
    const t = taskId ? d.tasks.get(taskId) : undefined;
    return t?.courseId ? d.courses.get(t.courseId) : undefined;
  };

  return (
    <Screen
      refreshControl={account?.mode === 'user' ? <RefreshControl refreshing={sync.status === 'syncing'} onRefresh={() => void syncNow('manual')} /> : undefined}
    >
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="small" color="textMuted">
            {formatInstant(now, d.tz)}
          </T>
          <T variant="h1">
            {greeting(hour)}, {prefs.displayName.split(' ')[0]}
          </T>
          <SyncBadge />
        </View>
        <Mascot pose={d.today.completedForToday ? 'celebrate' : 'welcome'} skin={prefs.mascotSkin} accessory={prefs.mascotAccessory} size={78} />
      </Row>

      {account?.mode === 'demo' && (
        <Card tone="reward" flat>
          <T variant="small" weight="700">
            Sample semester · Tobi is fictional. Nothing here is real student data.
          </T>
        </Card>
      )}

      <Card
        tone="reward"
        onPress={() => router.push('/(tabs)/journey')}
        accessibilityLabel={`Level ${d.level.level}, ${d.level.name}. ${d.xp} XP. Open Journey.`}
      >
        <Row style={{ flexWrap: 'nowrap' }}>
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: c.borderStrong,
              backgroundColor: c.reward,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T variant="h3" style={{ color: c.textOnAccent }}>
              Lv {d.level.level}
            </T>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="bodyStrong">{d.level.name}</T>
            <XpBar progress={d.level.progress} label={`Level progress ${Math.round(d.level.progress * 100)} percent`} />
            <T variant="caption" color="rewardText">
              {d.xp} XP · {d.level.nextLevelXp - d.xp} to level {d.level.level + 1}
              {d.pendingXp > 0 && account?.mode === 'user' ? ` · ${d.pendingXp} pending sync` : ''}
            </T>
          </View>
        </Row>
      </Card>

      {d.today.missedEarlier.length > 0 && (
        <Card tone="energy">
          <T variant="h3">{d.today.missedEarlier.length === 1 ? 'A session didn’t happen' : `${d.today.missedEarlier.length} sessions didn’t happen`}</T>
          <T variant="small" color="textSecondary">
            {d.today.missedEarlier
              .slice(0, 2)
              .map(
                (s) =>
                  `${d.tasks.get(s.taskId)?.title ?? 'Session'} · ${relativeDay(Date.parse(s.startAt), now, d.tz)} ${formatTimeOfDay(Date.parse(s.startAt), d.tz)}`,
              )
              .join(' · ')}
            . That’s okay — you still have a next step.
          </T>
          <Row>
            <Button
              label="Find a new time"
              variant="ink"
              small
              onPress={() =>
                router.push({
                  pathname: '/recovery',
                  params: {
                    kind: 'missed_session',
                    sessionIds: d.today.missedEarlier.map((s) => s.id).join(','),
                  },
                })
              }
            />
            <Button
              label="Just mark missed"
              variant="ghost"
              small
              onPress={async () => {
                for (const m of d.today.missedEarlier)
                  await run((s, ctx) => markSessionMissed(s, m.id, ctx), {
                    quiet: true,
                  });
              }}
            />
          </Row>
        </Card>
      )}

      {next && nextTask ? (
        <Card tone="primary">
          <Row gap={6}>
            <Timer size={16} color={c.primarySoftText} />
            <T variant="label" color="primarySoftText">
              {next.inProgress ? 'HAPPENING NOW' : `NEXT · ${formatTimeOfDay(Date.parse(next.startAt!), d.tz)}`}
            </T>
          </Row>
          <Row gap={8} style={{ flexWrap: 'nowrap' }}>
            <Dot color={course(nextTask.id)?.color} />
            <T variant="h2" style={{ flex: 1 }}>
              {next.label ?? nextTask.title}
            </T>
          </Row>
          {next.label ? <T color="textSecondary">{nextTask.title}</T> : null}
          <T variant="bodyStrong">
            {formatMinutes(next.minutes)} · {course(nextTask.id)?.code ?? 'Personal'}
          </T>
          {next.reasons.slice(0, 2).map((r) => (
            <T key={r} variant="small" color="textSecondary">
              • {r}
            </T>
          ))}
          <Row>
            <Button
              label="Start focus"
              small
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/focus',
                  params: { sessionId: next.sessionId! },
                })
              }
            />
            <Button
              label="Log it"
              variant="secondary"
              small
              onPress={() =>
                router.push({
                  pathname: '/checkin',
                  params: { sessionId: next.sessionId!, mode: 'manual' },
                })
              }
            />
            <Button label="Details" variant="ghost" small onPress={() => router.push(`/task/${nextTask.id}`)} />
          </Row>
        </Card>
      ) : d.today.completedForToday ? (
        <Card>
          <Empty
            xml={sceneSvg('emptyDone')}
            title="That’s today done."
            body={`${formatMinutes(d.today.doneMinutes)} of focused work. Rest counts too — NextStep won’t pile on more.`}
          />
        </Card>
      ) : (
        <Card>
          <Empty
            xml={sceneSvg('emptyDone')}
            title={live(state.tasks).length ? 'Nothing else planned today.' : 'No tasks yet.'}
            body={live(state.tasks).length ? 'Your next session is on the Plan tab.' : 'Add a task and NextStep will plan around your week.'}
          />
          {extra && (
            <Row gap={6} style={{ justifyContent: 'center' }}>
              <Sparkles size={16} color={c.rewardText} />
              <T variant="small">Optional, if you have energy: </T>
              <T variant="small" weight="800">
                {extra.title}
              </T>
            </Row>
          )}
        </Card>
      )}

      <Pressable
        onPress={() => router.push('/recovery')}
        accessibilityRole="button"
        accessibilityLabel="My plans changed. Missed something, less time or a new deadline?"
        style={({ pressed }) => ({
          transform: [{ translateY: pressed ? 3 : 0 }],
        })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            minHeight: 76,
            padding: 16,
            borderRadius: 22,
            borderWidth: 2,
            borderColor: c.borderStrong,
            backgroundColor: c.energy,
          }}
        >
          <Shuffle size={26} color={c.textOnAccent} />
          <View style={{ flex: 1 }}>
            <T variant="h3" style={{ color: c.textOnAccent }}>
              My plans changed
            </T>
            <T variant="small" style={{ color: c.textOnAccent }}>
              Missed something, less time, a new deadline?
            </T>
          </View>
        </View>
      </Pressable>

      {later.length > 0 && (
        <View style={{ gap: 8 }}>
          <SectionLabel>Later today</SectionLabel>
          {later.map((a) => (
            <ListRow
              key={a.sessionId}
              title={a.label ?? a.title}
              subtitle={`${formatTimeOfDay(Date.parse(a.startAt!), d.tz)} · ${formatMinutes(a.minutes)}`}
              left={<Dot color={course(a.taskId)?.color} />}
              onPress={() => router.push(`/task/${a.taskId}`)}
            />
          ))}
        </View>
      )}

      <View style={{ gap: 8 }}>
        <SectionLabel
          right={<Button label="Add task" small variant="secondary" icon={<Plus size={16} color={c.textPrimary} />} onPress={() => router.push('/task/new')} />}
        >
          Upcoming deadlines
        </SectionLabel>
        {d.today.upcomingDeadlines.length === 0 ? (
          <T variant="small" color="textMuted">
            No upcoming deadlines.
          </T>
        ) : (
          d.today.upcomingDeadlines.map((u) => {
            const tp = d.taskPlans.get(u.taskId);
            return (
              <ListRow
                key={u.taskId}
                title={u.title}
                subtitle={`Due ${formatInstant(Date.parse(u.dueAt), d.tz)}`}
                left={<Dot color={course(u.taskId)?.color} />}
                right={tp ? <StatusChip status={tp.status} /> : null}
                onPress={() => router.push(`/task/${u.taskId}`)}
              />
            );
          })
        )}
      </View>

      {goal ? (
        <Card tone="calm">
          <Row gap={8}>
            <BookHeart size={18} color={c.calmText} />
            <T variant="h3">{goal.title}</T>
          </Row>
          <XpBar tone="calm" progress={goalDone / goal.weeklyTargetMinutes} label={`${goalDone} of ${goal.weeklyTargetMinutes} minutes this week`} />
          <T variant="small" color="textSecondary">
            {goalDone} of {goal.weeklyTargetMinutes} min this week · optional, for you
          </T>
          <Row>
            <Button
              label={`Log ${goal.sessionMinutes} min`}
              small
              variant="secondary"
              onPress={() => void run((s, ctx) => goalCheckin(s, goal.id, goal.sessionMinutes, null, ctx), { toast: 'Goal time logged' })}
            />
            <Button label="Goals" small variant="ghost" onPress={() => router.push('/goals')} />
          </Row>
        </Card>
      ) : (
        <Button label="Add a personal goal" variant="ghost" onPress={() => router.push('/goals')} />
      )}
    </Screen>
  );
}
