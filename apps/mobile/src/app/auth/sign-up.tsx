import { useState } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../lib/store';
import { Button, Card, Field, Notice, Screen, T } from '../../ui/kit';
import { authErrorMessage, deviceTimezone } from '../../lib/format';

export default function SignUp() {
  const signUp = useApp((s) => s.signUp);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tooShort = password.length > 0 && password.length < 10;
  return (
    <Screen>
      <T variant="h1">Create your account</T>
      <T color="textSecondary">An account backs up your plan and syncs between devices. We only ask for what planning needs.</T>
      <Card>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Display name" value={name} onChangeText={setName} maxLength={60} autoComplete="name" />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={tooShort ? 'Use at least 10 characters — a short phrase works well.' : null} hint="At least 10 characters. A phrase like “bus to campus at seven” is strong and memorable." />
        <Button
          label="Create account"
          loading={busy}
          disabled={!name.trim() || !email || password.length < 10}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await signUp({ email: email.trim(), password, displayName: name.trim(), timezone: deviceTimezone() });
              router.replace('/');
            } catch (e) {
              setError(authErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
        <T variant="caption" color="textMuted">
          By creating an account you agree to the draft terms and privacy notice on the NextStep website.
        </T>
        <Button label="Read the privacy notice" variant="ghost" small onPress={() => void Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL ?? 'https://nextstep.example.com'}/privacy`)} />
      </Card>
    </Screen>
  );
}
