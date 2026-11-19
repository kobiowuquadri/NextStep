import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../lib/store';
import { authErrorMessage } from '../../lib/format';
import { useSlow } from '../../lib/useSlow';
import { Button, Card, Field, Mascot, Notice, Screen, T } from '../../ui/kit';
import { looksLikeEmail, PasswordField } from '../../ui/PasswordField';

export default function SignIn() {
  const signIn = useApp((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const slow = useSlow(busy);
  const passwordRef = useRef<TextInputInstance>(null);
  const emailError = touchedEmail && email.trim() && !looksLikeEmail(email) ? 'That doesn’t look like an email address.' : null;
  const canSubmit = looksLikeEmail(email) && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
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
  };

  return (
    <Screen>
      <Mascot pose="welcome" size={80} />
      <T variant="h1">Welcome back</T>
      <Card>
        {error && <Notice tone="danger">{error}</Notice>}
        {slow && <Notice>Waking up the NextStep server. After a quiet spell this can take up to a minute.</Notice>}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          onBlur={() => setTouchedEmail(true)}
          error={emailError}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <PasswordField ref={passwordRef} label="Password" value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => void submit()} />
        <Button label="Sign in" loading={busy} disabled={!canSubmit} onPress={() => void submit()} />
        <Button label="Forgot password?" variant="ghost" onPress={() => router.push('/auth/reset')} />
      </Card>
      <Button label="Create an account instead" variant="secondary" onPress={() => router.replace('/auth/sign-up')} />
    </Screen>
  );
}
