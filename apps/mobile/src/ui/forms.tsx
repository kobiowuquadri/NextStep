import { useState, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius } from '@nextstep/design-tokens';
import { formatMinutes } from '@nextstep/contracts';
import { Check, ChevronDown, Search, X } from './icons';
import { Button, Field, T } from './kit';
import { fontFor, useTheme } from './theme';

export interface SelectOption<V> {
  value: V;
  label: string;
  hint?: string;
}

/** A bottom sheet that slides up over the screen. Closes on the backdrop, the X or the back button. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { c, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.overlay }} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '85%',
            backgroundColor: c.canvas,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderWidth: 2,
            borderBottomWidth: 0,
            borderColor: c.borderStrong,
            paddingHorizontal: 18,
            paddingTop: 10,
            paddingBottom: insets.bottom + 16,
            gap: 12,
          }}
        >
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.border }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <T variant="h3" style={{ flex: 1 }} accessibilityRole="header">
              {title}
            </T>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
              <X size={20} color={c.textPrimary} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Dropdown: shows the current choice like a field and opens a sheet with the options.
 * Long lists get a search box, so nothing has to be typed exactly.
 */
export function SelectField<V extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  hint,
  error,
  searchable = options.length > 8,
  searchPlaceholder = 'Search',
}: {
  label: string;
  value: V | null;
  options: Array<SelectOption<V>>;
  onChange: (v: V) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find((o) => o.value === value);
  const query = q.trim().toLowerCase();
  const shown = query ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(query)) : options;
  const close = () => setOpen(false);
  return (
    <View style={{ gap: 6 }}>
      <T variant="small" weight="700">
        {label}
      </T>
      <Pressable
        onPress={() => {
          setQ('');
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'not chosen'}`}
        accessibilityHint="Opens a list to choose from"
        style={({ pressed }) => ({
          minHeight: 50,
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: error ? c.danger : c.borderStrong,
          backgroundColor: pressed ? c.surfaceSubtle : c.surface,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        })}
      >
        <View style={{ flex: 1 }}>
          <T numberOfLines={1} color={current ? 'textPrimary' : 'textMuted'}>
            {current?.label ?? placeholder}
          </T>
          {current?.hint ? (
            <T variant="caption" color="textMuted" numberOfLines={1}>
              {current.hint}
            </T>
          ) : null}
        </View>
        <ChevronDown size={20} color={c.textSecondary} />
      </Pressable>
      {error ? (
        <T variant="small" color="dangerText">
          {error}
        </T>
      ) : hint ? (
        <T variant="caption" color="textMuted">
          {hint}
        </T>
      ) : null}

      <Sheet visible={open} title={label} onClose={close}>
        {searchable && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderRadius: radius.md, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: c.surface, paddingHorizontal: 12 }}>
            <Search size={18} color={c.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={searchPlaceholder}
              placeholderTextColor={c.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel={searchPlaceholder}
              style={{ flex: 1, minHeight: 44, color: c.textPrimary, fontFamily: fontFor('body'), fontSize: 16 }}
            />
          </View>
        )}
        <FlatList
          data={shown}
          keyExtractor={(o) => String(o.value)}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0 }}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          ListEmptyComponent={
            <T color="textMuted" style={{ paddingVertical: 12 }}>
              No matches. Try a shorter search.
            </T>
          }
          renderItem={({ item }) => {
            const on = item.value === value;
            return (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  close();
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.hint ? `${item.label}, ${item.hint}` : item.label}
                style={({ pressed }) => ({
                  minHeight: 52,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: on ? c.borderStrong : c.border,
                  backgroundColor: on ? c.primarySoft : pressed ? c.surfaceSubtle : c.surface,
                })}
              >
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong">{item.label}</T>
                  {item.hint ? (
                    <T variant="caption" color="textMuted">
                      {item.hint}
                    </T>
                  ) : null}
                </View>
                {on && <Check size={20} color={c.primarySoftText} />}
              </Pressable>
            );
          }}
        />
      </Sheet>
    </View>
  );
}

/** Chips while there are only a few options, a dropdown once the list gets long. */
export function ChoiceOrSelect<V extends string | number>(props: { label: string; value: V; options: Array<SelectOption<V>>; onChange: (v: V) => void; max?: number }) {
  const { max = 5, ...rest } = props;
  const { c } = useTheme();
  if (rest.options.length > max || rest.options.some((o) => o.label.length > 24)) return <SelectField {...rest} />;
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={rest.label}>
      <T variant="small" weight="700">
        {rest.label}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {rest.options.map((o) => {
          const on = o.value === rest.value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => rest.onChange(o.value)}
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
      </View>
    </View>
  );
}

/** A text field with tappable suggestions underneath. Typing filters them; any text is still allowed. */
export function SuggestField({
  suggestions,
  value,
  onChangeText,
  max = 8,
  suggestionsLabel = 'Suggestions',
  ...field
}: Omit<Parameters<typeof Field>[0], 'value' | 'onChangeText'> & { value: string; onChangeText: (v: string) => void; suggestions: string[]; max?: number; suggestionsLabel?: string }) {
  const { c } = useTheme();
  const q = value.trim().toLowerCase();
  const matches = suggestions.filter((s) => s.toLowerCase() !== q && (!q || s.toLowerCase().includes(q))).slice(0, max);
  return (
    <View style={{ gap: 8 }}>
      <Field {...field} value={value} onChangeText={onChangeText} />
      {matches.length > 0 && (
        <View style={{ gap: 6 }}>
          <T variant="caption" color="textMuted">
            {q ? 'Did you mean' : suggestionsLabel}
          </T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
            {matches.map((s) => (
              <Pressable
                key={s}
                onPress={() => onChangeText(s)}
                accessibilityRole="button"
                accessibilityLabel={`Use ${s}`}
                style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 2, borderColor: c.border, backgroundColor: pressed ? c.primarySoft : c.surfaceSubtle, justifyContent: 'center' })}
              >
                <T variant="small" weight="700">
                  {s}
                </T>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/** Durations without typing: common amounts as chips, then fine-tune in 15-minute steps. */
export function DurationPick({
  label,
  value,
  onChange,
  presets = [30, 60, 90, 120, 180, 300],
  min = 5,
  max = 6000,
  step = 15,
  hint,
  zeroLabel,
}: {
  label: string;
  value: number;
  onChange: (m: number) => void;
  presets?: number[];
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  /** When set, 0 is allowed and shown with this label (e.g. "Finished"). */
  zeroLabel?: string;
}) {
  const { c } = useTheme();
  const floor = zeroLabel ? 0 : min;
  const clamp = (m: number) => Math.max(floor, Math.min(max, m));
  const describe = (m: number) => (m === 0 && zeroLabel ? zeroLabel : formatMinutes(m));
  const chips = [...(zeroLabel ? [0] : []), ...presets];
  return (
    <View style={{ gap: 8 }}>
      <T variant="small" weight="700">
        {label}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {chips.map((m) => {
          const on = m === value;
          return (
            <Pressable
              key={m}
              onPress={() => onChange(m)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={describe(m)}
              style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: on ? c.primary : c.surface, justifyContent: 'center' }}
            >
              <T variant="small" weight="700" style={{ color: on ? c.textOnPrimary : c.textPrimary }}>
                {describe(m)}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Button label={`− ${step} min`} small variant="secondary" disabled={value <= floor} onPress={() => onChange(clamp(value - step))} />
        <T variant="bodyStrong" center style={{ flex: 1 }} accessibilityRole="text">
          {describe(value)}
        </T>
        <Button label={`+ ${step} min`} small variant="secondary" disabled={value >= max} onPress={() => onChange(clamp(value + step))} />
      </View>
      {hint ? (
        <T variant="caption" color="textMuted">
          {hint}
        </T>
      ) : null}
    </View>
  );
}

/** A list of actions in a bottom sheet — Android alerts can only show three buttons. */
export function ActionSheet({
  visible,
  title,
  message,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  actions: Array<{ label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: ReactNode }>;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {message ? <T color="textSecondary">{message}</T> : null}
      <View style={{ gap: 10 }}>
        {actions.map((a) => (
          <Button
            key={a.label}
            label={a.label}
            variant={a.variant ?? 'secondary'}
            icon={a.icon}
            onPress={() => {
              onClose();
              a.onPress();
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}
