import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { authedRequest } from '../../lib/api';
import { authErrorMessage } from '../../lib/format';
import { useApp } from '../../lib/store';
import { Button, Card, Field, Notice, Screen, SectionLabel, T } from '../../ui/kit';

export default function Privacy() {
  const { account, state, signOut, deleteAccount, syncNow } = useApp();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!account || !state) return null;

  const exportData = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = account.mode === 'user' ? await authedRequest(account.userId, 'GET', '/v1/me/export') : { exportedAt: new Date().toISOString(), format: 'nextstep-local-export-v1', data: state };
      const file = new File(Paths.cache, `nextstep-export-${new Date().toISOString().slice(0, 10)}.json`);
      if (file.exists) file.delete();
      file.create();
      await file.write(JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Your NextStep data' });
      else Alert.alert('Export ready', `Saved to ${file.uri}`);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = async () => {
    if (account.mode !== 'user') {
      // Guest data exists only on this phone, so leaving is destructive: confirm first.
      Alert.alert(
        'Leave guest mode?',
        'Everything you added in guest mode is stored only on this phone and will be deleted. Export it first if you want a copy.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete and leave', style: 'destructive', onPress: async () => { await signOut(); router.replace('/welcome'); } },
        ],
      );
      return;
    }
    const r = await signOut();
    if (r.ok) return router.replace('/welcome');
    Alert.alert(
      'Unsynced changes',
      `${r.pending} change(s) on this phone haven’t reached your account yet. Signing out deletes this phone’s copy.`,
      [
        { text: 'Sync now', onPress: () => void syncNow('manual') },
        { text: 'Sign out and discard', style: 'destructive', onPress: async () => { await signOut({ discardUnsynced: true }); router.replace('/welcome'); } },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <Screen>
      <T variant="h1">Privacy & account</T>
      <Card>
        <T variant="h3">What NextStep stores</T>
        <T variant="small" color="textSecondary">
          Only what planning needs: your name, {account.mode === 'user' ? 'email, ' : ''}timezone, and the courses, tasks, times and check-ins you add. No ads, no trackers, no public profile. Your sign-in tokens are kept in this phone’s secure keystore. The planning data on this phone is stored in the app’s private storage (not separately encrypted) — keep a screen lock on your phone.
        </T>
      </Card>
      {error && <Notice tone="danger">{error}</Notice>}
      <SectionLabel>Your data</SectionLabel>
      <Button label="Export my data (JSON)" variant="secondary" loading={busy} onPress={() => void exportData()} />
      {account.mode !== 'user' && <Notice>Guest data lives only on this phone. Leaving guest mode deletes it.</Notice>}

      <SectionLabel>Session</SectionLabel>
      <Button label={account.mode === 'user' ? 'Sign out' : 'Leave guest mode (deletes data)'} variant="ink" onPress={() => void doSignOut()} />

      {account.mode === 'user' && (
        <Card tone="danger">
          <T variant="h3" color="dangerText">
            Delete account
          </T>
          <T variant="small">This permanently deletes your account and all its data from our servers and from this phone. It can’t be undone. Export first if you want a copy.</T>
          <Field label="Confirm with your password" value={password} onChangeText={setPassword} secureTextEntry />
          <Button
            label="Delete my account"
            variant="danger"
            disabled={password.length < 1}
            loading={busy}
            onPress={() =>
              Alert.alert('Delete everything?', 'Your account and all planning data will be permanently deleted.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await deleteAccount(password);
                      router.replace('/welcome');
                    } catch (e) {
                      setError(authErrorMessage(e));
                    } finally {
                      setBusy(false);
                    }
                  },
                },
              ])
            }
          />
        </Card>
      )}
    </Screen>
  );
}
