import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Lock } from '../../ui/icons';
import { addDaysToKey, formatDateKey, MASCOT_ACCESSORIES, MASCOT_SKINS } from '@nextstep/contracts';
import { updatePreferences } from '@nextstep/engine';
import { ACCESSORY_LABELS, badgeSvg, SKINS, type BadgeKey } from '@nextstep/illustrations';
import { LEVEL_NAMES, xpForLevel } from '@nextstep/gamification';
import { useDerived } from '../../lib/derive';
import { useApp } from '../../lib/store';
import { Art, Button, Card, Mascot, Row, Screen, SectionLabel, T, XpBar } from '../../ui/kit';
import { useTheme } from '../../ui/theme';

const ACTIVE = new Set(['task_completed', 'subtask_completed', 'focus_completed', 'goal_checkin', 'practice_completed', 'checkin_completed']);

export default function Journey() {
  const { c } = useTheme();
  const { state, run, account } = useApp();
  const d = useDerived();
  if (!state || !d) return null;
  const prefs = state.preferences;
  const stations = Array.from({ length: 6 }, (_, i) => Math.max(1, d.level.level - 1) + i).filter((l) => l <= LEVEL_NAMES.length);

  return (
    <Screen>
      <T variant="h1">Journey</T>
      <Card tone="reward">
        <Row style={{ flexWrap: 'nowrap' }}>
          <Mascot pose="encourage" skin={prefs.mascotSkin} accessory={prefs.mascotAccessory} size={96} label="Nex cheering you on" />
          <View style={{ flex: 1, gap: 6 }}>
            <T variant="label" color="primarySoftText">
              LEVEL {d.level.level}
            </T>
            <T variant="h2">{d.level.name}</T>
            <XpBar progress={d.level.progress} label="Level progress" />
            <T variant="caption" color="rewardText">
              {d.xp} XP · {d.level.nextLevelXp - d.xp} XP to {LEVEL_NAMES[d.level.level] ?? `level ${d.level.level + 1}`}
            </T>
          </View>
        </Row>
        {account?.mode === 'user' && d.pendingXp > 0 && (
          <T variant="caption" color="textMuted">
            {d.pendingXp} XP is waiting to sync. It’s counted already and is confirmed when you’re back online — syncing late never costs XP.
          </T>
        )}
      </Card>

      <SectionLabel>Your path</SectionLabel>
      <View style={{ gap: 2 }}>
        {stations.map((l) => {
          const done = l < d.level.level;
          const now = l === d.level.level;
          return (
            <Row key={l} style={{ flexWrap: 'nowrap', paddingVertical: 4 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: now ? c.borderStrong : done ? c.success : c.border, backgroundColor: now ? c.primary : done ? c.successSoft : c.surface }}>
                <T variant="bodyStrong" style={{ color: now ? c.textOnPrimary : done ? c.successText : c.textMuted }}>
                  {l}
                </T>
              </View>
              <View>
                <T variant="bodyStrong" color={now ? 'textPrimary' : 'textMuted'}>
                  {LEVEL_NAMES[l - 1]}
                </T>
                <T variant="caption" color="textMuted">
                  {xpForLevel(l)} XP{done ? ' · reached' : now ? ' · you are here' : ''}
                </T>
              </View>
            </Row>
          );
        })}
      </View>

      {prefs.streaksEnabled && (
        <Card>
          <T variant="h3">Steady weeks</T>
          <Row gap={6}>
            {Array.from({ length: 7 }, (_, i) => {
              const k = addDaysToKey(d.weekStart, i);
              const on = d.ledger.some((e) => e.localDate === k && ACTIVE.has(e.type));
              return (
                <View key={k} accessibilityLabel={`${formatDateKey(k)}: ${on ? 'active' : 'not active'}`} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: on ? c.success : c.border, backgroundColor: on ? c.successSoft : c.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <T variant="caption" style={{ color: on ? c.successText : c.textMuted }}>
                    {formatDateKey(k).slice(0, 2)}
                  </T>
                </View>
              );
            })}
          </Row>
          <T variant="small" color="textSecondary">
            {d.steady.activeDaysThisWeek} of {d.steady.goal} active days this week (your goal). {d.steady.streak > 0 ? `${d.steady.streak} steady week${d.steady.streak > 1 ? 's' : ''} in a row. ` : ''}Missing a day never resets your progress.
          </T>
        </Card>
      )}

      <SectionLabel>Quests</SectionLabel>
      {[...d.quests.daily, ...d.quests.weekly].map((q) => (
        <Card key={q.instanceId} tone={q.complete ? 'success' : 'surface'} flat>
          <T variant="caption" color="primarySoftText">
            {q.def.cadence === 'daily' ? 'TODAY' : 'THIS WEEK'}
          </T>
          <T variant="bodyStrong">{q.def.title}</T>
          <T variant="small" color="textSecondary">
            {q.def.description}
          </T>
          <XpBar progress={q.progress / q.def.target} label={`${q.def.title}: ${q.progress} of ${q.def.target}`} tone="reward" />
          <T variant="caption" color="textMuted">
            {q.complete ? `Done · +${q.def.xp} XP` : `${q.progress}/${q.def.target} · ${q.def.xp} XP`}
          </T>
        </Card>
      ))}

      <SectionLabel>Badges</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {d.achievements.map((a) => {
          const unlocked = d.unlockedIds.has(a.id);
          return (
            <View key={a.id} accessible accessibilityLabel={`${a.title}: ${unlocked ? 'unlocked. ' + a.description : 'locked. ' + a.rule}`} style={{ width: '47%', alignItems: 'center', gap: 4, padding: 12, borderRadius: 18, borderWidth: 2, borderColor: c.border, backgroundColor: c.surface }}>
              <Art xml={badgeSvg(a.badge as BadgeKey, { locked: !unlocked })} width={72} />
              <T variant="bodyStrong" center color={unlocked ? 'textPrimary' : 'textMuted'}>
                {a.title}
              </T>
              <T variant="caption" center color="textMuted">
                {unlocked ? a.description : a.rule}
              </T>
            </View>
          );
        })}
      </View>

      <Card>
        <T variant="h3">Style Nex</T>
        <T variant="small" color="textMuted">
          Cosmetic only — nothing here locks a feature.
        </T>
        <Row gap={10}>
          {MASCOT_SKINS.map((s) => {
            const has = d.cosmetics.skins.includes(s);
            return (
              <Pressable key={s} disabled={!has} onPress={() => void run((st, ctx) => updatePreferences(st, { mascotSkin: s }, ctx), { quiet: true })} accessibilityRole="radio" accessibilityState={{ checked: prefs.mascotSkin === s, disabled: !has }} accessibilityLabel={`${SKINS[s].label}${has ? '' : ', locked'}`} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: prefs.mascotSkin === s ? 4 : 2, borderColor: c.borderStrong, backgroundColor: SKINS[s].body, opacity: has ? 1 : 0.4, alignItems: 'center', justifyContent: 'center' }}>
                {!has && <Lock size={14} color="#fff" />}
              </Pressable>
            );
          })}
        </Row>
        <Row gap={8}>
          {MASCOT_ACCESSORIES.map((a) => {
            const has = d.cosmetics.accessories.includes(a);
            const on = prefs.mascotAccessory === a;
            return (
              <Pressable key={a} disabled={!has} onPress={() => void run((st, ctx) => updatePreferences(st, { mascotAccessory: a }, ctx), { quiet: true })} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !has }} accessibilityLabel={`${ACCESSORY_LABELS[a]}${has ? '' : ', locked'}`} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 999, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: on ? c.primary : c.surface, opacity: has ? 1 : 0.45, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {!has && <Lock size={12} color={c.textMuted} />}
                <T variant="small" weight="700" style={{ color: on ? c.textOnPrimary : c.textPrimary }}>
                  {ACCESSORY_LABELS[a]}
                </T>
              </Pressable>
            );
          })}
        </Row>
      </Card>

      <Button label="Weekly reflection" variant="secondary" onPress={() => router.push('/reflection')} />
    </Screen>
  );
}
