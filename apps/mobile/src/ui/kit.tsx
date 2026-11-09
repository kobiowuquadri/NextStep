import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { AlertTriangle, CheckCircle2, CircleDot, Hourglass, Waves } from './icons';
import { radius, typeScale, type SemanticColors, type TypeVariant } from '@nextstep/design-tokens';
import { mascotSvg, type MascotAccessoryName, type MascotPose, type MascotSkinName } from '@nextstep/illustrations';
import { fontFor, useTheme } from './theme';

type ColorKey = keyof SemanticColors;

export function T({ variant = 'body', color = 'textPrimary', weight, style, children, center, ...rest }: { variant?: TypeVariant; color?: ColorKey; weight?: string; style?: StyleProp<TextStyle>; children: ReactNode; center?: boolean; numberOfLines?: number; accessibilityRole?: 'header' | 'text'; selectable?: boolean }) {
  const { c } = useTheme();
  const v = typeScale[variant];
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={v.family === 'display' ? 1.4 : 1.8}
      accessibilityRole={rest.accessibilityRole ?? (variant === 'display' || variant === 'h1' || variant === 'h2' ? 'header' : undefined)}
      style={[{ fontFamily: fontFor(variant, weight), fontSize: v.size, lineHeight: v.lineHeight, color: c[color], textAlign: center ? 'center' : undefined }, style]}
    >
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'energy' | 'ink' | 'ghost' | 'danger';

/** Tactile button: a solid offset shadow that the face presses into. Min height 52 (48 for small). */
export function Button({ label, onPress, variant = 'primary', icon, small, disabled, loading, accessibilityHint, style, testID }: { label: string; onPress: () => void; variant?: ButtonVariant; icon?: ReactNode; small?: boolean; disabled?: boolean; loading?: boolean; accessibilityHint?: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { c } = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.primary, fg: c.textOnPrimary, border: c.borderStrong },
    secondary: { bg: c.surface, fg: c.textPrimary, border: c.borderStrong },
    energy: { bg: c.energy, fg: c.textOnAccent, border: c.borderStrong },
    ink: { bg: c.surfaceInverse, fg: c.textInverse, border: c.borderStrong },
    ghost: { bg: 'transparent', fg: c.primarySoftText, border: 'transparent' },
    danger: { bg: c.dangerSoft, fg: c.dangerText, border: c.danger },
  };
  const p = palette[variant];
  const flat = variant === 'ghost';
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      {({ pressed }) => (
        <View style={{ paddingBottom: flat ? 0 : 4 }}>
          {!flat && <View style={[StyleSheet.absoluteFill, { top: 4, borderRadius: radius.pill, backgroundColor: c.tactileShadow }]} />}
          <View
            style={{
              minHeight: small ? 44 : 52,
              paddingHorizontal: small ? 16 : 22,
              borderRadius: radius.pill,
              borderWidth: 2,
              borderColor: p.border,
              backgroundColor: flat && pressed ? c.primarySoft : p.bg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transform: [{ translateY: pressed && !flat ? 3 : 0 }],
            }}
          >
            {loading ? <ActivityIndicator color={p.fg} /> : icon}
            <T variant={small ? 'small' : 'bodyStrong'} weight="800" style={{ color: p.fg }}>
              {label}
            </T>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export type Tone = 'surface' | 'primary' | 'reward' | 'energy' | 'calm' | 'success' | 'danger' | 'subtle';

export function Card({ children, tone = 'surface', style, onPress, accessibilityLabel, flat }: { children: ReactNode; tone?: Tone; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; flat?: boolean }) {
  const { c } = useTheme();
  const bg: Record<Tone, string> = { surface: c.surface, primary: c.primarySoft, reward: c.rewardSoft, energy: c.energySoft, calm: c.calmSoft, success: c.successSoft, danger: c.dangerSoft, subtle: c.surfaceSubtle };
  const body = (pressed: boolean) => (
    <View style={{ paddingBottom: flat ? 0 : 4, paddingRight: flat ? 0 : 3 }}>
      {!flat && <View style={[StyleSheet.absoluteFill, { top: 4, left: 3, borderRadius: radius.lg, backgroundColor: c.tactileShadow }]} />}
      <View style={[{ backgroundColor: bg[tone], borderRadius: radius.lg, borderWidth: 2, borderColor: flat ? c.border : c.borderStrong, padding: 16, gap: 8, transform: [{ translateY: pressed ? 2 : 0 }] }, style]}>{children}</View>
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

export function Screen({ children, scroll = true, padded = true, refreshControl, testID }: { children: ReactNode; scroll?: boolean; padded?: boolean; refreshControl?: React.ReactElement<any>; testID?: string }) {
  const { c } = useTheme();
  const inner = <View style={{ padding: padded ? 18 : 0, gap: 16, paddingBottom: 40 }}>{children}</View>;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.canvas }} testID={testID}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" refreshControl={refreshControl as never}>
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Art({ xml, width, height, label }: { xml: string; width: number; height?: number; label?: string }) {
  return (
    <View accessible={!!label} accessibilityRole={label ? 'image' : undefined} accessibilityLabel={label} importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}>
      <SvgXml xml={xml} width={width} height={height ?? width} />
    </View>
  );
}

export function Mascot({ pose = 'welcome', skin = 'violet', accessory = 'none', size = 96, label }: { pose?: MascotPose; skin?: string; accessory?: string; size?: number; label?: string }) {
  const { reduceMotion } = useTheme();
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    // A brief reaction (two small hops) when Nex appears or changes pose — not an endless loop,
    // which would waste battery on low-cost phones and keep the UI from ever going idle.
    const hop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -5, duration: 260, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
      { iterations: 2 },
    );
    hop.start();
    return () => hop.stop();
  }, [bob, reduceMotion, pose]);
  return (
    <Animated.View style={{ transform: [{ translateY: bob }] }}>
      <Art xml={mascotSvg({ pose, skin: skin as MascotSkinName, accessory: accessory as MascotAccessoryName })} width={size} height={(size * 220) / 210} label={label} />
    </Animated.View>
  );
}

export function XpBar({ progress, label, tone = 'primary' }: { progress: number; label: string; tone?: 'primary' | 'calm' | 'reward' }) {
  const { c, reduceMotion } = useTheme();
  const pct = Math.max(0, Math.min(1, progress));
  const w = useRef(new Animated.Value(reduceMotion ? pct : 0)).current;
  useEffect(() => {
    if (reduceMotion) w.setValue(pct);
    else Animated.timing(w, { toValue: pct, duration: 650, useNativeDriver: false }).start();
  }, [pct, reduceMotion, w]);
  const fill = tone === 'calm' ? c.calm : tone === 'reward' ? c.reward : c.primary;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }} style={{ height: 14, borderRadius: 999, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: c.surface, overflow: 'hidden' }}>
      <Animated.View style={{ height: '100%', borderRadius: 999, backgroundColor: fill, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'calm' | 'muted'; Icon: typeof CheckCircle2 }> = {
  on_track: { label: 'On track', tone: 'success', Icon: CheckCircle2 },
  tight: { label: 'Tight', tone: 'warning', Icon: Hourglass },
  at_risk: { label: 'At risk', tone: 'danger', Icon: AlertTriangle },
  blocked: { label: 'Waiting', tone: 'warning', Icon: Hourglass },
  overdue: { label: 'Overdue', tone: 'danger', Icon: AlertTriangle },
  flexible: { label: 'Flexible', tone: 'calm', Icon: Waves },
  done: { label: 'Done', tone: 'success', Icon: CheckCircle2 },
  pending: { label: 'Not synced yet', tone: 'warning', Icon: Hourglass },
  missed: { label: 'Missed', tone: 'muted', Icon: CircleDot },
};

/** Status always shows an icon and a word — never colour alone. */
export function StatusChip({ status }: { status: string }) {
  const { c } = useTheme();
  const s = STATUS[status] ?? { label: status, tone: 'muted' as const, Icon: CircleDot };
  const colors = { success: [c.successSoft, c.successText], warning: [c.warningSoft, c.warningText], danger: [c.dangerSoft, c.dangerText], calm: [c.calmSoft, c.calmText], muted: [c.surfaceSubtle, c.textMuted] }[s.tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors[0], paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
      <s.Icon size={14} color={colors[1]} />
      <T variant="caption" weight="800" style={{ color: colors[1] }}>
        {s.label}
      </T>
    </View>
  );
}

export function Dot({ color }: { color?: string }) {
  const { c } = useTheme();
  return <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: color ?? c.border }} />;
}

export function Row({ children, style, gap = 10 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function ListRow({ title, subtitle, left, right, onPress, accessibilityLabel }: { title: string; subtitle?: string; left?: ReactNode; right?: ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  const { c } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 2, borderColor: c.border, backgroundColor: c.surface }}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong" numberOfLines={2}>
          {title}
        </T>
        {subtitle ? (
          <T variant="small" color="textMuted" numberOfLines={3}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {content}
    </Pressable>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
      <T variant="label" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }} accessibilityRole="header">
        {children}
      </T>
      {right}
    </Row>
  );
}

export function Field({ label, error, hint, ...input }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="small" weight="700">
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        maxFontSizeMultiplier={1.6}
        {...input}
        style={[{ minHeight: 50, borderRadius: radius.md, borderWidth: 2, borderColor: error ? c.danger : c.borderStrong, backgroundColor: c.surface, color: c.textPrimary, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fontFor('body'), fontSize: 16 }, input.style]}
      />
      {error ? (
        <T variant="small" color="dangerText" accessibilityRole="text">
          {error}
        </T>
      ) : hint ? (
        <T variant="caption" color="textMuted">
          {hint}
        </T>
      ) : null}
    </View>
  );
}

/** Single-choice chips (radio semantics). */
export function Choice<V extends string | number>({ label, value, options, onChange }: { label?: string; value: V; options: Array<{ value: V; label: string }>; onChange: (v: V) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? (
        <T variant="small" weight="700">
          {label}
        </T>
      ) : null}
      <Row gap={8}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.label}
              style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: on ? c.primary : c.surface, justifyContent: 'center' }}
            >
              <T variant="small" weight="700" style={{ color: on ? c.textOnPrimary : c.textPrimary }}>
                {o.label}
              </T>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}

export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} accessibilityHint={hint} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong">{label}</T>
        {hint ? (
          <T variant="small" color="textMuted">
            {hint}
          </T>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.border }} thumbColor={c.surface} importantForAccessibility="no-hide-descendants" />
    </Pressable>
  );
}

export function Empty({ xml, title, body, action }: { xml: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
      <Art xml={xml} width={190} height={142} />
      <T variant="h3" center>
        {title}
      </T>
      {body ? (
        <T variant="small" color="textSecondary" center>
          {body}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function Notice({ tone = 'calm', children }: { tone?: 'calm' | 'warning' | 'danger' | 'success'; children: ReactNode }) {
  const { c } = useTheme();
  const map = { calm: [c.calmSoft, c.calmText], warning: [c.warningSoft, c.warningText], danger: [c.dangerSoft, c.dangerText], success: [c.successSoft, c.successText] }[tone];
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: map[0], borderRadius: radius.md, padding: 12 }}>
      <T variant="small" weight="600" style={{ color: map[1] }}>
        {children}
      </T>
    </View>
  );
}
