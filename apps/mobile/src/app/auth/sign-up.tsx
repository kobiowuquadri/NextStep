import { useRef, useState } from 'react';
import { Linking, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../../lib/store';
import { Button, Card, Field, Notice, Screen, T } from '../../ui/kit';
import { looksLikeEmail, PasswordField } from '../../ui/PasswordField';
import { authErrorMessage, deviceTimezone } from '../../lib/format';
import { useSlow } from '../../lib/useSlow';

export default function SignUp() {
  const signUp = useApp((s) => s.signUp);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const slow = useSlow(busy);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const tooShort = password.length > 0 && password.length < 10;
  const emailError = touchedEmail && email.trim() && !looksLikeEmail(email) ? 'That doesn’t look like an email address.' : null;
  const canSubmit = !!name.trim() && looksLikeEmail(email) && password.length >= 10 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
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
  };

  return (
    <Screen>
      <T variant="h1">Create your account</T>
      <T color="textSecondary">An account backs up your plan and syncs between devices. We only ask for what planning needs.</T>
      <Card>
        {error && <Notice tone="danger">{error}</Notice>}
        {slow && <Notice>Waking up the NextStep server. After a quiet spell this can take up to a minute.</Notice>}
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          maxLength={60}
          autoComplete="name"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
          hint="Only shown to you, in the app."
        />
        <Field
          ref={emailRef}
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
        <PasswordField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={tooShort ? `Use at least 10 characters (${10 - password.length} more). A short phrase works well.` : null}
          hint="At least 10 characters. A phrase like “bus to campus at seven” is strong and memorable."
        />
        <Button label="Create account" loading={busy} disabled={!canSubmit} onPress={() => void submit()} />
        <T variant="caption" color="textMuted">
          By creating an account you agree to the draft terms and privacy notice on the NextStep website.
        </T>
        <Button label="Read the privacy notice" variant="ghost" small onPress={() => void Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL ?? 'https://nextstep.example.com'}/privacy`)} />
      </Card>
      <Button label="I already have an account" variant="secondary" onPress={() => router.replace('/auth/sign-in')} />
    </Screen>
  );
}
