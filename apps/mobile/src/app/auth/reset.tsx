import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { publicRequest } from '../../lib/api';
import { Button, Card, Field, Notice, Screen, T } from '../../ui/kit';
import { authErrorMessage } from '../../lib/format';

/** Two steps: request an emailed code, then set a new password with it. */
export default function Reset() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'request' | 'confirm' | 'done'>(params.token ? 'confirm' : 'request');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen>
      <T variant="h1">Reset password</T>
      {step === 'request' && (
        <Card>
          {error && <Notice tone="danger">{error}</Notice>}
          <T color="textSecondary">Enter your account email. If it exists, we’ll send a reset link with a code. It works for 30 minutes.</T>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Button
            label="Send reset link"
            loading={busy}
            disabled={!email}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await publicRequest<{ message: string }>('POST', '/v1/auth/password-reset/request', { email: email.trim() });
                setMsg(r.message);
                setStep('confirm');
              } catch (e) {
                setError(authErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      )}
      {step === 'confirm' && (
        <Card>
          {msg && <Notice>{msg}</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="Reset code" value={token} onChangeText={setToken} autoCapitalize="none" hint="Paste the code from the email link." />
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry hint="At least 10 characters." />
          <Button
            label="Set new password"
            loading={busy}
            disabled={token.length < 20 || password.length < 10}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await publicRequest('POST', '/v1/auth/password-reset/confirm', { token: token.trim(), newPassword: password });
                setStep('done');
              } catch (e) {
                setError(authErrorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      )}
      {step === 'done' && (
        <Card tone="success">
          <T variant="h3">Password updated</T>
          <T color="textSecondary">For your safety, you’ve been signed out on other devices.</T>
          <Button label="Sign in" onPress={() => router.replace('/auth/sign-in')} />
        </Card>
      )}
    </Screen>
  );
}
