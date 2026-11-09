import { router } from 'expo-router';
import { BookOpenCheck, CalendarRange, ChevronRight, Cloud, Notebook, Settings, ShieldCheck, Target } from '../../ui/icons';
import { useApp } from '../../lib/store';
import { Card, ListRow, Mascot, Row, Screen, SectionLabel, T } from '../../ui/kit';
import { SyncBadge } from '../../ui/SyncBadge';
import { useTheme } from '../../ui/theme';

export default function Profile() {
  const { c } = useTheme();
  const { state, account } = useApp();
  if (!state || !account) return null;
  const prefs = state.preferences;
  const chevron = <ChevronRight size={18} color={c.textMuted} />;
  const links: Array<{ title: string; subtitle: string; href: string; Icon: typeof Cloud }> = [
    { title: 'Planning & preferences', subtitle: 'Session length, daily limit, theme, motion, haptics, streaks', href: '/settings/preferences', Icon: Settings },
    { title: 'Study time & commitments', subtitle: 'Windows, work, lectures, commute, protected rest', href: '/settings/time', Icon: CalendarRange },
    { title: 'Courses', subtitle: 'Add or edit courses', href: '/settings/courses', Icon: Notebook },
    { title: 'Personal goals', subtitle: 'Reading, exercise, a skill', href: '/goals', Icon: Target },
    { title: 'Resources', subtitle: 'Practice checks you can download', href: '/resources', Icon: BookOpenCheck },
    { title: 'Sync', subtitle: account.mode === 'user' ? 'Status, waiting changes, conflicts' : 'Saved on this phone only', href: '/sync', Icon: Cloud },
    { title: 'Privacy & account', subtitle: 'Export, delete, sign out', href: '/settings/privacy', Icon: ShieldCheck },
  ];
  return (
    <Screen>
      <Row style={{ flexWrap: 'nowrap' }}>
        <Mascot pose="welcome" skin={prefs.mascotSkin} accessory={prefs.mascotAccessory} size={72} />
        <Card style={{ flex: 1 }} flat>
          <T variant="h2">{prefs.displayName}</T>
          <T variant="small" color="textMuted">
            {account.mode === 'user' ? account.email : account.mode === 'demo' ? 'Sample semester (fictional)' : 'Guest on this phone'}
          </T>
          <T variant="caption" color="textMuted">
            {prefs.timezone}
            {prefs.institution ? ` · ${prefs.institution}` : ''}
          </T>
          <SyncBadge />
        </Card>
      </Row>
      <SectionLabel>Settings</SectionLabel>
      {links.map((l) => (
        <ListRow key={l.href} title={l.title} subtitle={l.subtitle} left={<l.Icon size={20} color={c.primarySoftText} />} right={chevron} onPress={() => router.push(l.href as never)} />
      ))}
      <T variant="caption" color="textMuted" center>
        NextStep by Team Apex · v1.0.0
      </T>
    </Screen>
  );
}
