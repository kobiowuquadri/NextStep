import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AlertTriangle, Briefcase, Bus, Coffee, GraduationCap, Heart, Pin, Plus, RefreshCw, Settings2, Shuffle } from '../../ui/icons';
import { formatDateKey, formatMinutes, formatTimeOfDay, localDateKey, weekdayOfKey } from '@nextstep/contracts';
import { canUndo, currentRevision, generatePlanAction, live, setSessionPinned, undoRevision } from '@nextstep/engine';
import { sceneSvg } from '@nextstep/illustrations';
import { analyzePlan } from '@nextstep/scheduler';
import { toPlannerInput } from '@nextstep/engine';
import { useDerived } from '../../lib/derive';
import { useApp } from '../../lib/store';
import { Button, Card, Choice, Dot, Empty, ListRow, Notice, Row, Screen, SectionLabel, StatusChip, T } from '../../ui/kit';
import { useTheme } from '../../ui/theme';

const KIND_ICON = { work: Briefcase, commute: Bus, class: GraduationCap, family: Heart, rest: Coffee, worship: Heart, other: Briefcase } as const;
const KIND_LABEL: Record<string, string> = { assignment: 'Assignment', exam: 'Exam / test', revision: 'Revision', reading: 'Reading', project: 'Project', practice: 'Practice', personal: 'Personal' };

export default function Plan() {
  const { c } = useTheme();
  const { state, run, account } = useApp();
  const d = useDerived();
  const [tab, setTab] = useState<'week' | 'tasks'>('week');
  const [day, setDay] = useState<string | null>(null);
  if (!state || !d) return null;
  const selected = day ?? d.day;
  const manual = state.preferences.planningMode === 'manual';
  const sessions = live(state.sessions)
    .filter((s) => localDateKey(Date.parse(s.startAt), d.tz) === selected && s.status !== 'skipped')
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const commitments = live(state.commitments)
    .filter((co) => (co.date ? co.date === selected : co.weekdays.includes(weekdayOfKey(selected))))
    .sort((a, b) => a.start.localeCompare(b.start));
  const load = d.analysis.days.find((x) => x.date === selected);
  const latest = live(state.planRevisions).filter((r) => !r.undoneAt && r.reason !== 'undo').sort((a, b) => b.number - a.number)[0];
  const undo = latest && latest.number === currentRevision(state) ? canUndo(state, latest.id) : null;
  const issues = manual ? analyzePlan(toPlannerInput(state, Date.now())) : [];
  const shortfall = d.analysis.shortfall;
  const rows = [
    ...commitments.map((co) => ({ key: `c${co.id}`, at: co.start, node: (
      <View key={`c${co.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: c.border, backgroundColor: c.surfaceSubtle }}>
        {(() => {
          const Icon = KIND_ICON[co.kind] ?? Briefcase;
          return <Icon size={18} color={c.textMuted} />;
        })()}
        <View style={{ flex: 1 }}>
          <T variant="bodyStrong" color="textSecondary">
            {co.title}
          </T>
          <T variant="caption" color="textMuted">
            {co.start}–{co.end}
            {co.protected ? ' · protected' : ''}
          </T>
        </View>
      </View>
    ) })),
    ...sessions.map((s) => {
      const t = d.tasks.get(s.taskId);
      const course = t?.courseId ? d.courses.get(t.courseId) : undefined;
      const past = s.status === 'planned' && Date.parse(s.endAt) <= Date.now();
      return { key: s.id, at: formatTimeOfDay(Date.parse(s.startAt), d.tz), node: (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          accessibilityLabel={`${formatTimeOfDay(Date.parse(s.startAt), d.tz)}, ${s.minutes} minutes, ${d.labelOf(s) ?? t?.title}${s.pinned ? ', pinned' : ''}${s.status !== 'planned' ? `, ${s.status}` : ''}`}
          onPress={() =>
            Alert.alert(d.labelOf(s) ?? t?.title ?? 'Session', `${formatTimeOfDay(Date.parse(s.startAt), d.tz)}–${formatTimeOfDay(Date.parse(s.endAt), d.tz)} · ${s.minutes} min.\nMoving a session never changes the task’s real deadline.`, [
              { text: 'Log it', onPress: () => router.push({ pathname: '/checkin', params: { sessionId: s.id, mode: 'manual' } }) },
              { text: 'I missed this', onPress: () => router.push({ pathname: '/recovery', params: { kind: 'missed_session', sessionIds: s.id } }) },
              { text: s.pinned ? 'Unpin' : 'Pin this time', onPress: () => void run((st, ctx) => setSessionPinned(st, s.id, !s.pinned, ctx), { toast: s.pinned ? 'Unpinned' : 'Pinned — replanning keeps it here' }) },
              { text: 'Close', style: 'cancel' },
            ])
          }
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 2, borderLeftWidth: 8, borderColor: c.borderStrong, borderLeftColor: course?.color ?? c.primary, backgroundColor: c.surface, opacity: s.status !== 'planned' || past ? 0.6 : 1 }}
        >
          <View style={{ minWidth: 52 }}>
            <T variant="bodyStrong">{formatTimeOfDay(Date.parse(s.startAt), d.tz)}</T>
            <T variant="caption" color="textMuted">
              {s.minutes} min
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong" numberOfLines={2}>
              {d.labelOf(s) ?? t?.title}
            </T>
            <T variant="caption" color="textMuted">
              {d.labelOf(s) ? `${t?.title} · ` : ''}
              {course?.code ?? 'Personal'}
            </T>
          </View>
          {s.pinned && <Pin size={16} color={c.textSecondary} />}
          {s.status === 'done' ? <StatusChip status="done" /> : s.status === 'missed' || past ? <StatusChip status="missed" /> : null}
        </Pressable>
      ) };
    }),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="h1">Plan</T>
        <Button label="Availability" small variant="ghost" icon={<Settings2 size={16} color={c.primarySoftText} />} onPress={() => router.push('/settings/time')} />
      </Row>
      <Choice value={tab} options={[{ value: 'week', label: 'Week' }, { value: 'tasks', label: 'Tasks' }]} onChange={setTab} />

      {shortfall && (
        <Card tone="danger">
          <Row gap={8}>
            <AlertTriangle size={18} color={c.dangerText} />
            <T variant="h3" color="dangerText">
              Not everything fits
            </T>
          </Row>
          <T variant="small">{shortfall.message}</T>
          {shortfall.options.slice(0, 4).map((o) => (
            <View key={o.kind + (o.deferTaskId ?? '') + (o.taskId ?? '')} style={{ gap: 2, padding: 10, borderRadius: 12, backgroundColor: c.surface }}>
              <T variant="small" weight="800">
                {o.title}
              </T>
              <T variant="caption" color="textSecondary">
                {o.detail}
              </T>
            </View>
          ))}
        </Card>
      )}

      {tab === 'week' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
            {d.week.map((k) => {
              const count = live(state.sessions).filter((s) => s.status === 'planned' && localDateKey(Date.parse(s.startAt), d.tz) === k).length;
              const on = k === selected;
              return (
                <Pressable key={k} onPress={() => setDay(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${formatDateKey(k)}, ${count} sessions`} style={{ width: 58, minHeight: 74, paddingVertical: 8, borderRadius: 16, borderWidth: 2, borderColor: on ? c.borderStrong : c.border, backgroundColor: on ? c.primarySoft : c.surface, alignItems: 'center', gap: 2 }}>
                  <T variant="caption" color="textMuted">
                    {formatDateKey(k).split(' ')[0]}
                  </T>
                  <T variant="h3">{formatDateKey(k, false).split(' ')[0]}</T>
                  <View style={{ flexDirection: 'row', gap: 3 }}>
                    {Array.from({ length: Math.min(3, count) }, (_, i) => (
                      <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h2">{selected === d.day ? 'Today' : formatDateKey(selected)}</T>
            {load ? (
              <T variant="caption" color="textMuted">
                {formatMinutes(load.plannedMinutes + load.doneMinutes)} of {formatMinutes(load.limitMinutes)}
              </T>
            ) : null}
          </Row>
          {rows.length === 0 ? <Empty xml={sceneSvg('emptyPlan')} title="A free day" body="No commitments and no study planned. Rest is part of the plan." /> : <View style={{ gap: 8 }}>{rows.map((r) => r.node)}</View>}

          {manual && issues.length > 0 && (
            <Card tone="danger" flat>
              <T variant="bodyStrong">Manual plan check</T>
              {issues.slice(0, 5).map((i) => (
                <T key={i.kind + i.sessionIds.join()} variant="small">
                  • {i.message}
                </T>
              ))}
            </Card>
          )}

          <Row>
            <Button label="My plans changed" variant="energy" icon={<Shuffle size={18} color={c.textOnAccent} />} onPress={() => router.push('/recovery')} />
            {manual ? (
              <Button label="Add session" variant="secondary" icon={<Plus size={18} color={c.textPrimary} />} onPress={() => router.push('/settings/session')} />
            ) : (
              <Button
                label="Replan"
                variant="secondary"
                icon={<RefreshCw size={18} color={c.textPrimary} />}
                onPress={() => void run((s, ctx) => generatePlanAction(s, ctx).result, { batch: true, basePlanRevision: currentRevision(state), toast: 'Plan refreshed' })}
              />
            )}
          </Row>
          {undo?.ok && latest && (
            <Card flat>
              <T variant="small">Last change: {latest.summary}</T>
              <Button label="Undo this change" small variant="ghost" onPress={() => void run((s, ctx) => undoRevision(s, latest.id, ctx), { batch: true, basePlanRevision: currentRevision(state), toast: 'Undone' })} />
            </Card>
          )}
          {account?.mode !== 'user' && <Notice>Plans are saved on this phone. Create an account to back up and sync.</Notice>}
        </>
      ) : (
        <View style={{ gap: 8 }}>
          <SectionLabel right={<Button label="Add task" small icon={<Plus size={16} color={c.textOnPrimary} />} onPress={() => router.push('/task/new')} />}>
            {live(state.tasks).filter((t) => t.status !== 'done' && !t.goalId).length} open tasks
          </SectionLabel>
          {d.analysis.tasks.filter((tp) => !d.tasks.get(tp.taskId)?.goalId).length === 0 && <Empty xml={sceneSvg('emptyTasks')} title="No open tasks" body="Add an assignment, test or reading and NextStep will plan it." />}
          {d.analysis.tasks
            .filter((tp) => !d.tasks.get(tp.taskId)?.goalId)
            .map((tp) => {
              const t = d.tasks.get(tp.taskId)!;
              const course = t.courseId ? d.courses.get(t.courseId) : undefined;
              return <ListRow key={tp.taskId} title={t.title} subtitle={`${KIND_LABEL[t.kind]} · ${formatMinutes(t.remainingMinutes)} left\n${tp.explanation}`} left={<Dot color={course?.color} />} right={<StatusChip status={tp.status} />} onPress={() => router.push(`/task/${t.id}`)} />;
            })}
          {live(state.tasks)
            .filter((t) => t.status === 'done' && !t.goalId)
            .map((t) => (
              <ListRow key={t.id} title={t.title} subtitle="Completed" right={<StatusChip status="done" />} onPress={() => router.push(`/task/${t.id}`)} />
            ))}
          <Button label="Courses" variant="ghost" onPress={() => router.push('/settings/courses')} />
        </View>
      )}
    </Screen>
  );
}
