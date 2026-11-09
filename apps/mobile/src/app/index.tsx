import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { CloudOff } from '../ui/icons';
import { sceneSvg } from '@nextstep/illustrations';
import { useApp } from '../lib/store';
import { Button, Empty, Screen } from '../ui/kit';
import { useTheme } from '../ui/theme';

/** Entry gate: decides where the student lands. */
export default function Index() {
  const { phase, state, sync, retryFirstSync, signOut } = useApp();
  const { c } = useTheme();
  if (phase === 'signedOut') return <Redirect href="/welcome" />;
  if (phase === 'needsFirstSync') {
    return (
      <Screen>
        <Empty
          xml={sceneSvg('emptyOffline')}
          title={sync.status === 'syncing' ? 'Getting your plan…' : 'Connect once to finish setup'}
          body="Your first download needs a connection. After that, NextStep works offline and syncs when you’re back online."
          action={
            <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 12 }}>
              <Button label="Try again" icon={<CloudOff color={c.textOnPrimary} size={18} />} onPress={() => void retryFirstSync()} loading={sync.status === 'syncing'} />
              <Button label="Use a different account" variant="ghost" onPress={() => void signOut({ discardUnsynced: true })} />
            </View>
          }
        />
      </Screen>
    );
  }
  if (state && !state.preferences.onboardingCompletedAt) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
