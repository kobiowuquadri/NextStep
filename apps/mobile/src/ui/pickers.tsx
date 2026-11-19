import { useRef } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';
import { addDaysToKey, formatDateKey, formatHHMM, formatMinutes, parseHHMM } from '@nextstep/contracts';
import { T } from './kit';
import { useTheme } from './theme';
import { WEEKDAYS } from '../lib/format';

/** Scrolls a horizontal pill row so the selected pill is visible when it first lays out (and after the options change). */
function useScrollToSelected(value: string) {
  const ref = useRef<ScrollViewInstance>(null);
  const shownFor = useRef<string | null>(null);
  const onSelectedLayout = (e: LayoutChangeEvent) => {
    if (shownFor.current === value) return;
    shownFor.current = value;
    ref.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 24), animated: false });
  };
  return { ref, onSelectedLayout };
}

function Pill({ label, on, onPress, a11y, onLayout }: { label: string; on: boolean; onPress: () => void; a11y?: string; onLayout?: (e: LayoutChangeEvent) => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onLayout={onLayout}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={a11y ?? label}
      style={{ minHeight: 44, minWidth: 48, paddingHorizontal: 12, borderRadius: 14, borderWidth: 2, borderColor: on ? c.borderStrong : c.border, backgroundColor: on ? c.primary : c.surface, alignItems: 'center', justifyContent: 'center' }}
    >
      <T variant="small" weight="700" style={{ color: on ? c.textOnPrimary : c.textPrimary }}>
        {label}
      </T>
    </Pressable>
  );
}

/** Pick a date from the next `days` days. Works offline, no native picker needed. */
export function DatePick({ label, today, value, onChange, days = 45 }: { label: string; today: string; value: string; onChange: (d: string) => void; days?: number }) {
  const { ref, onSelectedLayout } = useScrollToSelected(value);
  return (
    <View style={{ gap: 8 }}>
      <T variant="small" weight="700">
        {label} · <T variant="small">{formatDateKey(value)}</T>
      </T>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {Array.from({ length: days }, (_, i) => addDaysToKey(today, i)).map((d, i) => (
          <Pill key={d} label={i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDateKey(d)} a11y={formatDateKey(d)} on={d === value} onPress={() => onChange(d)} onLayout={d === value ? onSelectedLayout : undefined} />
        ))}
      </ScrollView>
    </View>
  );
}

const TIMES = Array.from({ length: 39 }, (_, i) => formatHHMM(5 * 60 + i * 30)); // 05:00 … 24:00

export function TimePick({ label, value, onChange, min, max }: { label: string; value: string; onChange: (t: string) => void; min?: string; max?: string }) {
  const options = TIMES.filter((t) => (!min || parseHHMM(t) > parseHHMM(min)) && (!max || parseHHMM(t) <= parseHHMM(max)));
  const { ref, onSelectedLayout } = useScrollToSelected(value);
  return (
    <View style={{ gap: 8 }}>
      <T variant="small" weight="700">
        {label}
      </T>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((t) => (
          <Pill key={t} label={t === '24:00' ? 'Midnight' : t} on={t === value} onPress={() => onChange(t)} onLayout={t === value ? onSelectedLayout : undefined} />
        ))}
        {value === '23:59' && <Pill label="23:59" on onPress={() => undefined} />}
      </ScrollView>
    </View>
  );
}

/**
 * A start and end time that can't end up backwards: moving "From" past "To" pushes "To" an hour later.
 * Shows the resulting length so the window is easy to check at a glance.
 */
export function TimeRangePick({ from, to, onChange, fromLabel = 'From', toLabel = 'To' }: { from: string; to: string; onChange: (from: string, to: string) => void; fromLabel?: string; toLabel?: string }) {
  const end = parseHHMM(to) > parseHHMM(from) ? to : formatHHMM(Math.min(24 * 60, parseHHMM(from) + 60));
  return (
    <View style={{ gap: 12 }}>
      <TimePick
        label={fromLabel}
        value={from}
        max="23:30"
        onChange={(f) => onChange(f, parseHHMM(to) > parseHHMM(f) ? to : formatHHMM(Math.min(24 * 60, parseHHMM(f) + 60)))}
      />
      <TimePick label={toLabel} value={end} onChange={(t) => onChange(from, t)} min={from} />
      <T variant="caption" color="textMuted">
        {from}–{end === '24:00' ? 'midnight' : end} · {formatMinutes(parseHHMM(end) - parseHHMM(from))}
      </T>
    </View>
  );
}

export function WeekdayPick({ label, value, onChange }: { label: string; value: number[]; onChange: (v: number[]) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T variant="small" weight="700">
        {label}
      </T>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const on = value.includes(d);
          return (
            <Pressable
              key={d}
              onPress={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={WEEKDAYS[d]}
              style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: on ? c.borderStrong : c.border, backgroundColor: on ? c.primary : c.surface, alignItems: 'center', justifyContent: 'center' }}
            >
              <T variant="caption" weight="800" style={{ color: on ? c.textOnPrimary : c.textPrimary }}>
                {WEEKDAYS[d]!.slice(0, 2)}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
