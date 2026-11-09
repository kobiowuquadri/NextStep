import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Compass, House, Timer, UserRound } from '../../ui/icons';
import { fontFor, useTheme } from '../../ui/theme';

export default function TabsLayout() {
  const { c } = useTheme();
  // Edge-to-edge: keep labels clear of the system gesture/navigation bar.
  const insets = useSafeAreaInsets();
  const icon = (Icon: typeof House) => ({ color, focused }: { color: unknown; focused: boolean }) => <Icon color={String(color)} size={24} strokeWidth={focused ? 2.6 : 2} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.borderStrong, borderTopWidth: 2, height: 68 + insets.bottom, paddingTop: 6, paddingBottom: 8 + insets.bottom },
        tabBarLabelStyle: { fontFamily: fontFor('caption', '700'), fontSize: 12 },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon(House), tabBarAccessibilityLabel: 'Today' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon(CalendarDays), tabBarAccessibilityLabel: 'Plan' }} />
      <Tabs.Screen name="focus" options={{ title: 'Focus', tabBarIcon: icon(Timer), tabBarAccessibilityLabel: 'Focus' }} />
      <Tabs.Screen name="journey" options={{ title: 'Journey', tabBarIcon: icon(Compass), tabBarAccessibilityLabel: 'Journey' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon(UserRound), tabBarAccessibilityLabel: 'Profile' }} />
    </Tabs>
  );
}
