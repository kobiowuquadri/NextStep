import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Cloud, CloudOff, HardDrive, RefreshCw, TriangleAlert } from './icons';
import { useApp } from '../lib/store';
import { T } from './kit';
import { useTheme } from './theme';

/** Subtle sync state: icon + words, tap for details. */
export function SyncBadge() {
  const { c } = useTheme();
  const { account, sync } = useApp();
  if (!account) return null;
  let Icon = Cloud;
  let text = 'Synced';
  let color = c.successText;
  if (account.mode !== 'user') {
    Icon = HardDrive;
    text = 'Saved on this phone';
    color = c.textMuted;
  } else if (sync.status === 'syncing') {
    Icon = RefreshCw;
    text = 'Syncing…';
    color = c.calmText;
  } else if (sync.failed > 0 || sync.conflicts.length > 0 || sync.status === 'error') {
    Icon = TriangleAlert;
    text = sync.conflicts.length ? `${sync.conflicts.length} to review` : 'Sync needs attention';
    color = c.warningText;
  } else if (sync.status === 'offline') {
    Icon = CloudOff;
    text = sync.pending ? `Offline · ${sync.pending} waiting` : 'Offline · saved on phone';
    color = c.textMuted;
  } else if (sync.pending > 0) {
    Icon = RefreshCw;
    text = `${sync.pending} waiting to sync`;
    color = c.textMuted;
  }
  return (
    <Pressable onPress={() => router.push('/sync')} accessibilityRole="button" accessibilityLabel={`Sync status: ${text}. Open sync details.`} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 }}>
      <Icon size={14} color={color} />
      <T variant="caption" style={{ color }}>
        {text}
      </T>
    </Pressable>
  );
}
