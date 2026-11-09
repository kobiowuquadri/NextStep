import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useApp } from '../lib/store';
import { FONT_FILES, ThemeProvider, useTheme } from '../ui/theme';
import { CelebrationHost, ToastHost } from '../ui/overlays';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Shell() {
  const { c, dark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.canvas }, animation: 'slide_from_right' }}>
        <Stack.Screen name="recovery" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="checkin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <ToastHost />
      <CelebrationHost />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONT_FILES);
  const boot = useApp((s) => s.boot);
  const phase = useApp((s) => s.phase);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (fontsLoaded && phase !== 'booting') void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, phase]);

  if (!fontsLoaded || phase === 'booting') return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
