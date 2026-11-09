import { useState } from 'react';
import { router } from 'expo-router';
import { useApp } from '../../lib/store';
import { authErrorMessage } from '../../lib/format';
import { Button, Card, Field, Mascot, Notice, Screen, T } from '../../ui/kit';

export default function SignIn() {
  const signIn = useApp((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <Mascot pose="welcome" size={80} />
      <T variant="h1">Welcome back</T>
      <Card>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
        <Button
          label="Sign in"
          loading={busy}
          disabled={!email || !password}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await signIn(email.trim(), password);
              router.replace('/');
            } catch (e) {
              setError(authErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button label="Forgot password?" variant="ghost" onPress={() => router.push('/auth/reset')} />
      </Card>
      <Button label="Create an account instead" variant="secondary" onPress={() => router.replace('/auth/sign-up')} />
    </Screen>
  );
}
