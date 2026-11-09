import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, CalendarClock, CalendarX2, Feather, Hourglass, MessageSquareText, Siren, X } from '../ui/icons';
import { addDaysToKey, formatDateKey, formatInstant, formatMinutes, formatTimeOfDay, instantAt, localDateKey, type AiAvailabilityResponse, type RecoveryInput } from '@nextstep/contracts';
import { acceptRecovery, keepCurrentPlan, live, previewRecovery } from '@nextstep/engine';
import type { RecoveryChange, RecoveryProposal } from '@nextstep/scheduler';
import { authedRequest } from '../lib/api';
import { useApp } from '../lib/store';
import { Button, Card, Choice, Dot, Field, Mascot, Notice, Row, Screen, SectionLabel, T } from '../ui/kit';
import { DatePick, TimePick } from '../ui/pickers';
import { useTheme } from '../ui/theme';

type Kind = RecoveryInput['kind'];
const REASONS: Array<{ kind: Kind; title: string; hint: string; Icon: typeof Hourglass }> = [
  { kind: 'missed_session', title: 'I missed a session', hint: 'Fit the missed work back in', Icon: CalendarX2 },
  { kind: 'less_time', title: 'I have less time', hint: 'Shrink today to what’s realistic', Icon: Hourglass },
  { kind: 'deadline_changed', title: 'A deadline changed', hint: 'Only if it officially changed', Icon: CalendarClock },
  { kind: 'urgent', title: 'Something urgent came up', hint: 'Clear a day or two', Icon: Siren },
  { kind: 'lighter_day', title: 'I need a lighter day', hint: 'Keep a little, move the rest', Icon: Feather },
];
const CHANGE_LABEL: Record<RecoveryChange['kind'], string> = { moved: 'Moves', split: 'Split', shortened: 'Smaller step', added: 'Added', removed: 'Removed' };

export default function Recovery() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ kind?: Kind; sessionIds?: string }>();
  const { state, run, account, online } = useApp();
  const tz = state?.preferences.timezone ?? 'Africa/Lagos';
  const today = localDateKey(Date.now(), tz);
  const [kind, setKind] = useState<Kind | null>(params.kind ?? null);
  const [step, setStep] = useState<'choose' | 'details' | 'preview' | 'done'>(params.kind ? 'details' : 'choose');
  const [minutes, setMinutes] = useState(45);
  const [lightDate, setLightDate] = useState(today);
  const [lightMax, setLightMax] = useState(30);
  const [urgentDays, setUrgentDays] = useState(1);
  const [missed, setMissed] = useState<string[]>(params.sessionIds ? params.sessionIds.split(',').filter(Boolean) : []);
  const [taskId, setTaskId] = useState('');
  const [newDate, setNewDate] = useState(addDaysToKey(today, 3));
  const [newTime, setNewTime] = useState('18:00');
  const [confirmed, setConfirmed] = useState(false);
  const [proposal, setProposal] = useState<RecoveryProposal | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const candidates = useMemo(
    () => (state ? live(state.sessions).filter((s) => s.status === 'planned' && Date.parse(s.startAt) > Date.now() - 3 * 86_400_000 && Date.parse(s.startAt) < Date.now() + 2 * 86_400_000).sort((a, b) => a.startAt.localeCompare(b.startAt)) : []),
    [state],
  );
  useEffect(() => {
    if (params.kind === 'missed_session' && params.sessionIds && state) preview({ kind: 'missed_session', sessionIds: params.sessionIds.split(',') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!state) return null;

  const title = (id: string) => state.tasks.find((t) => t.id === id)?.title ?? 'Task';
  const when = (iso: string) => `${formatDateKey(localDateKey(Date.parse(iso), tz))} ${formatTimeOfDay(Date.parse(iso), tz)}`;
  const courseColor = (taskId: string) => {
    const t = state.tasks.find((x) => x.id === taskId);
    return t?.courseId ? state.courses.find((co) => co.id === t.courseId)?.color : undefined;
  };

  function input(): RecoveryInput | null {
    switch (kind) {
      case 'missed_session':
        return missed.length ? { kind, sessionIds: missed } : null;
      case 'less_time':
        return { kind, date: today, availableMinutes: minutes };
      case 'lighter_day':
        return { kind, date: lightDate, maxMinutes: lightMax };
      case 'urgent':
        return { kind, startDate: today, days: urgentDays };
      case 'deadline_changed':
        return taskId && confirmed ? { kind, taskId, newDueAt: new Date(instantAt(newDate, newTime, tz)).toISOString(), confirmedByStudent: true } : null;
      default:
        return null;
    }
  }

  function preview(i: RecoveryInput | null) {
    if (!i || !state) return;
    setProposal(previewRecovery(state, i, { now: Date.now(), newId: () => '' }));
    setStep('preview');
  }

  async function interpret() {
    if (!account || account.mode !== 'user') return;
    setAiBusy(true);
    setAiNote(null);
    try {
      const r = await authedRequest<AiAvailabilityResponse>(account.userId, 'POST', '/v1/ai/availability', { text: aiText, timezone: tz, now: new Date().toISOString() }, 25_000);
      if (r.kind === 'less_time' && r.availableMinutes !== null) {
        setKind('less_time');
        setMinutes(Math.max(0, Math.round(r.availableMinutes / 15) * 15));
      } else if (r.kind === 'lighter_day') {
        setKind('lighter_day');
        if (r.date) setLightDate(r.date);
      } else if (r.kind === 'urgent') {
        setKind('urgent');
        if (r.days) setUrgentDays(Math.min(3, r.days));
      }
      setAiNote(r.kind === 'unclear' ? 'I couldn’t tell what changed — pick the closest option below.' : `${r.explanation} Check the details below before continuing.`);
      setStep(r.kind === 'unclear' ? 'choose' : 'details');
    } catch {
      setAiNote('Suggestions aren’t available right now. Pick the closest option below — it works the same.');
    } finally {
      setAiBusy(false);
    }
  }

  async function accept() {
    if (!proposal) return;
    const res = await run((s, ctx) => acceptRecovery(s, proposal, ctx), { batch: true, basePlanRevision: proposal.baseRevision, toast: 'Plan recovered' });
    if ('error' in res) {
      // Something changed since the preview (e.g. a sync from another device). Never apply a stale plan.
      setProposal(previewRecovery(useApp.getState().state!, proposal.input, { now: Date.now(), newId: () => '' }));
      setNote('Your plan changed while you were reviewing, so the proposal was rebuilt. Please check it again.');
      return;
    }
    setStep('done');
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <T variant="h1">My plans changed</T>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
          <X size={20} color={c.textPrimary} />
        </Pressable>
      </Row>

      {step === 'choose' && (
        <>
          <T color="textSecondary">What changed? Pick the closest — you’ll see everything before anything moves.</T>
          {aiNote && <Notice>{aiNote}</Notice>}
          {REASONS.map(({ kind: k, title: t, hint, Icon }) => (
            <Card key={k} onPress={() => { setKind(k); setStep('details'); }} accessibilityLabel={`${t}. ${hint}`}>
              <Row style={{ flexWrap: 'nowrap' }}>
                <Icon size={24} color={c.energyText} />
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong">{t}</T>
                  <T variant="small" color="textMuted">
                    {hint}
                  </T>
                </View>
              </Row>
            </Card>
          ))}
          {account?.mode === 'user' && online && (
            <Card tone="subtle" flat>
              <Row gap={8}>
                <MessageSquareText size={18} color={c.textSecondary} />
                <T variant="bodyStrong">Or describe it (optional suggestion)</T>
              </Row>
              <Field label="What happened?" value={aiText} onChangeText={setAiText} placeholder="e.g. My shift ran late, I only have an hour tonight" maxLength={500} multiline />
              <Button label="Suggest an option" small variant="secondary" loading={aiBusy} disabled={aiText.trim().length < 3} onPress={() => void interpret()} />
              <T variant="caption" color="textMuted">
                Needs a connection. Your text is sent only to make a suggestion, and you confirm every detail.
              </T>
            </Card>
          )}
        </>
      )}

      {step === 'details' && (
        <Card>
          {aiNote && <Notice>{aiNote}</Notice>}
          {kind === 'less_time' && (
            <>
              <T variant="h3">How much time do you really have today?</T>
              <Choice value={minutes} options={[15, 30, 45, 60, 90].map((m) => ({ value: m, label: `${m} min` }))} onChange={setMinutes} />
              <T variant="small" color="textMuted">
                Your usual limit is {formatMinutes(state.preferences.dailyLimitMinutes)}.
              </T>
            </>
          )}
          {kind === 'lighter_day' && (
            <>
              <Choice label="Which day?" value={lightDate} options={[{ value: today, label: 'Today' }, { value: addDaysToKey(today, 1), label: 'Tomorrow' }]} onChange={setLightDate} />
              <Choice label="At most how much study?" value={lightMax} options={[0, 20, 30, 60].map((m) => ({ value: m, label: m === 0 ? 'None' : `${m} min` }))} onChange={setLightMax} />
            </>
          )}
          {kind === 'urgent' && (
            <>
              <Choice label="How many days, starting today?" value={urgentDays} options={[1, 2, 3].map((n) => ({ value: n, label: `${n} day${n > 1 ? 's' : ''}` }))} onChange={setUrgentDays} />
              <T variant="small" color="textMuted">
                Take care of what matters. You don’t need to say what happened.
              </T>
            </>
          )}
          {kind === 'missed_session' && (
            <>
              <T variant="h3">Which sessions didn’t (or won’t) happen?</T>
              {candidates.length === 0 && <T color="textMuted">No recent sessions to choose from.</T>}
              {candidates.map((s) => {
                const on = missed.includes(s.id);
                return (
                  <Pressable key={s.id} onPress={() => setMissed((m) => (on ? m.filter((x) => x !== s.id) : [...m, s.id]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${s.label ?? title(s.taskId)} ${when(s.startAt)}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, minHeight: 56, borderRadius: 14, borderWidth: 2, borderColor: on ? c.borderStrong : c.border, backgroundColor: on ? c.primarySoft : c.surface }}>
                    <Dot color={courseColor(s.taskId)} />
                    <View style={{ flex: 1 }}>
                      <T variant="bodyStrong">{s.label ?? title(s.taskId)}</T>
                      <T variant="caption" color="textMuted">
                        {when(s.startAt)} · {s.minutes} min
                      </T>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
          {kind === 'deadline_changed' && (
            <>
              <Choice label="Which deadline officially changed?" value={taskId} options={live(state.tasks).filter((t) => t.dueAt && t.status !== 'done' && !t.goalId).map((t) => ({ value: t.id, label: t.title }))} onChange={setTaskId} />
              <DatePick label="New date" today={today} value={newDate} onChange={setNewDate} />
              <TimePick label="New time" value={newTime} onChange={setNewTime} />
              <Pressable onPress={() => setConfirmed((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 48 }}>
                <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: confirmed ? c.primary : c.surface }} />
                <T variant="small" style={{ flex: 1 }}>
                  My lecturer or course officially changed this deadline. NextStep never moves a real deadline on its own.
                </T>
              </Pressable>
            </>
          )}
          <Button label="Show me the new plan" icon={<ArrowRight size={18} color={c.textOnPrimary} />} disabled={!input()} onPress={() => preview(input())} />
          <Button label="Back" variant="ghost" onPress={() => setStep('choose')} />
        </Card>
      )}

      {step === 'preview' && proposal && (
        <>
          {note && <Notice tone="warning">{note}</Notice>}
          <Row style={{ flexWrap: 'nowrap' }}>
            <Mascot pose="recovery" skin={state.preferences.mascotSkin} accessory={state.preferences.mascotAccessory} size={80} />
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="h2">{proposal.headline}</T>
              <T variant="small" color="textSecondary">
                {proposal.subline}
              </T>
            </View>
          </Row>
          {proposal.nextAction && (
            <Card tone="primary">
              <T variant="label" color="primarySoftText">
                YOUR NEXT STEP
              </T>
              <T variant="h3">{proposal.nextAction.label ?? proposal.nextAction.taskTitle}</T>
              <T variant="bodyStrong">
                {formatMinutes(proposal.nextAction.minutes)} · {when(proposal.nextAction.startAt)}
              </T>
            </Card>
          )}
          <SectionLabel>What changes ({proposal.changes.length})</SectionLabel>
          {proposal.changes.length === 0 && <T color="textMuted">Nothing needs to move.</T>}
          {(showAll ? proposal.changes : proposal.changes.slice(0, 4)).map((ch) => (
            <Card key={ch.taskId + ch.kind} flat>
              <T variant="label" color={ch.kind === 'removed' ? 'dangerText' : 'calmText'}>
                {CHANGE_LABEL[ch.kind].toUpperCase()}
              </T>
              <T variant="bodyStrong">{ch.taskTitle}</T>
              <T variant="caption" color="textMuted">
                Before: {ch.from.length ? ch.from.map((f) => `${when(f.startAt)} (${f.minutes}m)`).join(', ') : '—'}
              </T>
              <T variant="caption" weight="700">
                After: {ch.to.length ? ch.to.map((f) => `${when(f.startAt)} (${f.minutes}m)`).join(', ') : 'not scheduled'}
              </T>
              <T variant="small" color="textSecondary">
                {ch.why}
              </T>
            </Card>
          ))}
          {proposal.changes.length > 4 && <Button label={showAll ? 'Show fewer' : `Show all ${proposal.changes.length} changes`} variant="ghost" small onPress={() => setShowAll((v) => !v)} />}
          <SectionLabel>Stays the same ({proposal.unchanged.length})</SectionLabel>
          <T variant="small" color="textSecondary">
            {proposal.unchanged.length ? proposal.unchanged.slice(0, 3).map((s) => `${title(s.taskId)} ${when(s.startAt)}`).join(' · ') + (proposal.unchanged.length > 3 ? ` and ${proposal.unchanged.length - 3} more` : '') : 'Everything upcoming was affected.'}
          </T>
          {proposal.atRisk.length > 0 && (
            <Card tone="danger">
              <T variant="h3" color="dangerText">
                At risk
              </T>
              {proposal.atRisk.map((t) => (
                <T key={t.taskId} variant="small">
                  • {t.title}: {t.explanation}
                </T>
              ))}
              {proposal.plan.shortfall?.options.slice(0, 3).map((o) => (
                <T key={o.kind + (o.deferTaskId ?? '')} variant="small" color="textSecondary">
                  Option — {o.title}: {o.detail}
                </T>
              ))}
            </Card>
          )}
          <Button label="Accept changes" onPress={() => void accept()} />
          <Button label="Adjust proposal" variant="secondary" onPress={() => setStep(kind ? 'details' : 'choose')} />
          <Button
            label="Keep my current plan"
            variant="ghost"
            onPress={async () => {
              await run((s, ctx) => keepCurrentPlan(s, proposal, ctx), { toast: 'Kept your current plan' });
              router.back();
            }}
          />
          <T variant="caption" color="textMuted" center>
            Nothing has changed yet. You can undo from Plan until you start the new sessions.
          </T>
        </>
      )}

      {step === 'done' && proposal && (
        <Card style={{ alignItems: 'center' }}>
          <Mascot pose="encourage" skin={state.preferences.mascotSkin} accessory={state.preferences.mascotAccessory} size={130} />
          <T variant="h2" center>
            You still have a next step.
          </T>
          <T center color="textSecondary">
            Your plan is updated{account?.mode === 'user' ? ' on this phone and will sync when online' : ''}. Finish the next action to earn Back on Track.
          </T>
          {proposal.nextAction && (
            <Button label={`Start: ${proposal.nextAction.label ?? proposal.nextAction.taskTitle}`} onPress={() => router.replace({ pathname: '/(tabs)/focus', params: { sessionId: proposal.nextAction!.sessionId } })} />
          )}
          <Button label="Later" variant="ghost" onPress={() => router.back()} />
        </Card>
      )}
      <T variant="caption" color="textMuted" center>
        {formatInstant(Date.now(), tz)}
      </T>
    </Screen>
  );
}
