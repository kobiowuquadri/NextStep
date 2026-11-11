import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { sceneSvg } from '@nextstep/illustrations';
import { useApp } from '../lib/store';
import { deviceTimezone } from '../lib/format';
import { Art, Button, Card, Field, Mascot, Screen, T } from '../ui/kit';
import { useTheme } from '../ui/theme';

const SLIDES = [
  { scene: 'onboardingOrganise', title: 'Everything in one calm place', body: 'Courses, deadlines and the time you actually have — work, commute and rest included.' },
  { scene: 'onboardingPlan', title: 'A plan you can actually follow', body: 'NextStep splits work into sessions that fit your week, and explains every priority.' },
  { scene: 'onboardingRecover', title: 'Plans change. Keep moving.', body: 'When your week falls apart, tap “My plans changed” and get a smaller next step.' },
] as const;

export default function Welcome() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [slide, setSlide] = useState(0);
  const [guest, setGuest] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const { startGuest } = useApp();
  const s = SLIDES[slide]!;

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 4, marginTop: 8 }}>
        <Mascot pose="welcome" size={88} label="Nex, the NextStep companion, waving" />
        <T variant="display" center>
          NextStep
        </T>
        <T variant="small" color="textSecondary" center>
          by Team Apex
        </T>
      </View>

      <Card tone="primary" style={{ alignItems: 'center' }}>
        <Art xml={sceneSvg(s.scene)} width={Math.min(300, width - 80)} height={Math.min(225, (width - 80) * 0.75)} />
        <T variant="h2" center>
          {s.title}
        </T>
        <T center color="textSecondary">
          {s.body}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }} accessibilityRole="tablist">
          {SLIDES.map((x, i) => (
            <Pressable
              key={x.title}
              onPress={() => setSlide(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === slide }}
              accessibilityLabel={`Slide ${i + 1} of ${SLIDES.length}`}
              hitSlop={12}
              style={{ width: i === slide ? 28 : 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: i === slide ? c.primary : c.surface }}
            />
          ))}
        </View>
      </Card>

      {guest ? (
        <Card>
          <T variant="h3">What should we call you?</T>
          <Field label="Display name" value={name} onChangeText={setName} placeholder="e.g. Tobi" autoFocus maxLength={60} />
          <T variant="small" color="textMuted">
            Guest mode keeps everything on this phone only. Create an account later to back up and sync.
          </T>
          <Button
            label="Start planning"
            loading={busy}
            disabled={!name.trim()}
            onPress={async () => {
              setBusy(true);
              await startGuest(name.trim(), deviceTimezone());
              router.replace('/onboarding');
            }}
          />
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          <Button label="Create an account" onPress={() => router.push('/auth/sign-up')} />
          <Button label="I have an account" variant="secondary" onPress={() => router.push('/auth/sign-in')} />
          <Button label="Continue as guest" variant="ghost" onPress={() => setGuest(true)} accessibilityHint="Use NextStep on this phone without an account" />
        </View>
      )}
    </Screen>
  );
}
