import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { CloudDownload, HardDriveDownload, Trash2 } from '../../ui/icons';
import { setResourceDownloaded } from '@nextstep/engine';
import { sceneSvg } from '@nextstep/illustrations';
import { downloadResource, kb, listDownloads, loadCatalog, removeDownload, type CatalogItem } from '../../lib/resources';
import { useApp } from '../../lib/store';
import { Button, Card, Empty, Notice, Row, Screen, T } from '../../ui/kit';
import { useTheme } from '../../ui/theme';

export default function Resources() {
  const { c } = useTheme();
  const { db, account, online, run } = useApp();
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [downloaded, setDownloaded] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!db) return;
    const [cat, dls] = await Promise.all([loadCatalog(db, account?.mode === 'user'), listDownloads(db)]);
    setItems(cat.items);
    setError(cat.error);
    setDownloaded(new Map(dls.map((d) => [d.resource_id, d.size_bytes])));
  }, [db, account?.mode]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!db) return null;
  const total = [...downloaded.values()].reduce((a, b) => a + b, 0);

  return (
    <Screen>
      <T variant="h1">Resources</T>
      <T color="textSecondary">Short original guides and practice checks by Team Apex. Not reviewed by an educator — check them against your course materials.</T>
      {downloaded.size > 0 && (
        <T variant="small" color="textMuted">
          {downloaded.size} downloaded · {kb(total)} on this phone
        </T>
      )}
      {error && <Notice tone="warning">{error}</Notice>}
      {items === null && <ActivityIndicator />}
      {items && items.length === 0 && !error && <Empty xml={sceneSvg('emptyResources')} title="No resources yet" />}
      {items?.map((r) => {
        const isDown = downloaded.has(r.id);
        return (
          <Card key={r.id} tone={isDown ? 'success' : 'surface'} onPress={isDown ? () => router.push(`/resources/${r.id}`) : undefined} accessibilityLabel={`${r.title}. ${isDown ? 'Downloaded, available offline. Open.' : 'Online only.'}`}>
            <Row gap={6}>
              {isDown ? <HardDriveDownload size={16} color={c.successText} /> : <CloudDownload size={16} color={c.textMuted} />}
              <T variant="caption" weight="800" color={isDown ? 'successText' : 'textMuted'}>
                {isDown ? 'DOWNLOADED · WORKS OFFLINE' : r.source === 'bundled' ? 'INCLUDED SAMPLE · SAVE TO USE' : 'ONLINE ONLY'}
              </T>
            </Row>
            <T variant="h3">{r.title}</T>
            <T variant="small" color="textSecondary">
              {r.summary}
            </T>
            <T variant="caption" color="textMuted">
              {r.subject} · {r.estMinutes} min · {kb(r.sizeBytes)}
            </T>
            {isDown ? (
              <Row>
                <Button label="Open" small onPress={() => router.push(`/resources/${r.id}`)} />
                <Button
                  label="Delete download"
                  small
                  variant="ghost"
                  icon={<Trash2 size={16} color={c.primarySoftText} />}
                  onPress={async () => {
                    await removeDownload(db, r.id);
                    await run((s, ctx) => setResourceDownloaded(s, r.id, null, ctx), { quiet: true });
                    await refresh();
                  }}
                />
              </Row>
            ) : (
              <Button
                label={`Download (${kb(r.sizeBytes)})`}
                small
                variant="secondary"
                loading={busy === r.id}
                disabled={r.source === 'server' && !online}
                onPress={async () => {
                  setBusy(r.id);
                  try {
                    await downloadResource(db, r);
                    await run((s, ctx) => setResourceDownloaded(s, r.id, r.version, ctx), { toast: 'Saved for offline' });
                    await refresh();
                  } catch {
                    Alert.alert('Download failed', 'Check your connection and try again.');
                  } finally {
                    setBusy(null);
                  }
                }}
              />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
