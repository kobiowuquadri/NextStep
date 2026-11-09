import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { themes, typeScale, type SemanticColors, type TypeVariant } from '@nextstep/design-tokens';
import { useApp } from '../lib/store';

export const FONT_FILES = {
  BricolageGrotesque_700Bold: require('@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf'),
  BricolageGrotesque_800ExtraBold: require('@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf'),
  PlusJakartaSans_400Regular: require('@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf'),
  PlusJakartaSans_500Medium: require('@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf'),
  PlusJakartaSans_600SemiBold: require('@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'),
  PlusJakartaSans_700Bold: require('@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf'),
  PlusJakartaSans_800ExtraBold: require('@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'),
};

const BODY: Record<string, string> = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
};

export function fontFor(variant: TypeVariant, weight?: string): string {
  const v = typeScale[variant];
  const w = weight ?? v.weight;
  if (v.family === 'display') return w === '800' ? 'BricolageGrotesque_800ExtraBold' : 'BricolageGrotesque_700Bold';
  return BODY[w] ?? BODY['400']!;
}

interface Theme {
  c: SemanticColors;
  dark: boolean;
  reduceMotion: boolean;
}

const ThemeContext = createContext<Theme>({ c: themes.light, dark: false, reduceMotion: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useApp((s) => s.state?.preferences.theme ?? 'system');
  const motionPref = useApp((s) => s.state?.preferences.motion ?? 'system');
  const [systemReduce, setSystemReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduce);
    return () => sub.remove();
  }, []);
  const dark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const value = useMemo(
    () => ({ c: dark ? themes.dark : themes.light, dark, reduceMotion: motionPref === 'reduce' || (motionPref === 'system' && systemReduce) }),
    [dark, motionPref, systemReduce],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
