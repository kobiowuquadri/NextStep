import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { RefreshCw } from '../ui/icons';
import { formatInstant } from '@nextstep/contracts';
import { discardFailed } from '../lib/sync';
import { useApp } from '../lib/store';
import { Button, Card, ListRow, Notice, Screen, SectionLabel, T } from '../ui/kit';
import { SyncBadge } from '../ui/SyncBadge';
import { useTheme } from '../ui/theme';

const FIELD_LABEL: Record<string, string> = { dueAt: 'Deadline', estimatedMinutes: 'Estimated effort', remainingMinutes: 'Remaining effort', startAt: 'Start time', endAt: 'End time', status: 'Status', plan: 'Plan' };

function show(field: string, v: unknown, tz: string): string {
  if (v === null || v === undefined) return 'none';
  if ((field === 'dueAt' || field === 'startAt' || field === 'endAt') && typeof v === 'string') return formatInstant(Date.parse(v), tz);
  if (field.endsWith('Minutes')) return `${v} min`;
  if (typeof v === 'object') return 'another device’s plan';
  return String(v);
}

export default function SyncScreen() {
  const { c } = useTheme();
  const { account, sync, syncNow, db, state, resolveConflict, refreshSyncInfo } = useApp();
  const [failed, setFailed] = useState<Array<{ seq: number; entity: string; last_error: string | null }>>([]);
  const load = useCallback(async () => {
    if (db) setFailed(await db.getAllAsync(`SELECT seq, entity, last_error FROM outbox WHERE status = 'failed' ORDER BY seq`));
    await refreshSyncInfo();
  }, [db, refreshSyncInfo]);
  useEffect(() => {
    void load();
  }, [load, sync.status]);
  if (!account || !state) return null;
  const tz = state.preferences.timezone;

  if (account.mode !== 'user') {
    return (
      <Screen>
        <T variant="h1">Sync</T>
        <Notice>{account.mode === 'demo' ? 'The sample semester is fictional and stays on this phone.' : 'Guest mode keeps everything on this phone. Create an account to back up and sync between devices.'}</Notice>
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <T variant="h1">Sync</T>
      <Card>
        <SyncBadge />
        <T variant="small" color="textSecondary">
          {sync.lastSyncedAt ? `Last synced ${formatInstant(Date.parse(sync.lastSyncedAt), tz)}.` : 'Not synced yet.'} {sync.pending} change(s) waiting.
        </T>
        {sync.error && <Notice tone="warning">{sync.error}</Notice>}
        <Button label="Sync now" icon={<RefreshCw size={18} color={c.textOnPrimary} />} loading={sync.status === 'syncing'} onPress={() => void syncNow('manual')} />
        <T variant="caption" color="textMuted">
          Changes save on your phone first, then sync automatically when you open the app or reconnect. Phones can’t guarantee background sync, so open NextStep or tap Sync now after being offline.
        </T>
      </Card>

      {sync.conflicts.length > 0 && <SectionLabel>Needs your decision</SectionLabel>}
      {sync.conflicts.map((k) => {
        const title = state.tasks.find((t) => t.id === k.entityId)?.title ?? (k.entity === 'planRevision' ? 'Your plan' : 'A record');
        const isPlan = k.entity === 'planRevision';
        return (
          <Card key={k.id} tone="reward">
            <T variant="h3">{title}</T>
            <T variant="small" color="textSecondary">
              {isPlan ? 'Your plan changed on another device while this phone also changed it. Both versions were kept.' : 'This was changed on two devices at once. Both versions were kept — choose which is right.'}
            </T>
            {k.fields.map((f) => (
              <T key={f} variant="small">
                {FIELD_LABEL[f] ?? f}: this phone → {show(f, k.clientValues[f] ?? (isPlan ? k.clientValues : null), tz)} · other device → {show(f, k.serverValues[f] ?? (isPlan ? k.serverValues : null), tz)}
              </T>
            ))}
            {isPlan ? (
              <>
                <Button label="Keep the other device’s plan" small onPress={() => void resolveConflict(k.id, 'server')} />
                <Button label="Rebuild from my changes" small variant="secondary" onPress={async () => { await resolveConflict(k.id, 'server'); router.push('/recovery'); }} />
              </>
            ) : (
              <>
                <Button label="Use this phone’s version" small onPress={() => void resolveConflict(k.id, 'client')} />
                <Button label="Use the other device’s version" small variant="secondary" onPress={() => void resolveConflict(k.id, 'server')} />
              </>
            )}
          </Card>
        );
      })}

      {failed.length > 0 && (
        <>
          <SectionLabel>Couldn’t be saved</SectionLabel>
          {failed.map((f) => (
            <ListRow key={f.seq} title={`A ${f.entity} change`} subtitle={`Reason: ${f.last_error ?? 'rejected'}. It stays on this phone until you discard it.`} right={<Button label="Discard" small variant="ghost" onPress={async () => { if (db) await discardFailed(db, f.seq); await load(); }} />} />
          ))}
        </>
      )}
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
