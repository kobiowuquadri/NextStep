import { Pressable, ScrollView, View } from 'react-native';
import { addDaysToKey, formatDateKey, formatHHMM, parseHHMM } from '@nextstep/contracts';
import { T } from './kit';
import { useTheme } from './theme';
import { WEEKDAYS } from '../lib/format';

function Pill({ label, on, onPress, a11y }: { label: string; on: boolean; onPress: () => void; a11y?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
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
  return (
    <View style={{ gap: 8 }}>
      <T variant="small" weight="700">
        {label}
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup">
        {Array.from({ length: days }, (_, i) => addDaysToKey(today, i)).map((d, i) => (
          <Pill key={d} label={i === 0 ? 'Today' : i === 1 ? 'Tmrw' : formatDateKey(d)} a11y={formatDateKey(d)} on={d === value} onPress={() => onChange(d)} />
        ))}
      </ScrollView>
    </View>
  );
}

const TIMES = Array.from({ length: 39 }, (_, i) => formatHHMM(5 * 60 + i * 30)); // 05:00 … 24:00

export function TimePick({ label, value, onChange, min }: { label: string; value: string; onChange: (t: string) => void; min?: string }) {
  const options = TIMES.filter((t) => !min || parseHHMM(t) > parseHHMM(min));
  return (
    <View style={{ gap: 8 }}>
      <T variant="small" weight="700">
        {label}
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup">
        {options.map((t) => (
          <Pill key={t} label={t === '24:00' ? 'Midnight' : t} on={t === value} onPress={() => onChange(t)} />
        ))}
        {value === '23:59' && <Pill label="23:59" on onPress={() => undefined} />}
      </ScrollView>
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
