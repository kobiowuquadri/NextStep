import { router } from 'expo-router';
import type { Preferences } from '@nextstep/contracts';
import { updatePreferences } from '@nextstep/engine';
import { notificationPermission, rescheduleReminders } from '../../lib/notifications';
import { useApp } from '../../lib/store';
import { Button, Card, Choice, Screen, SectionLabel, T, Toggle } from '../../ui/kit';
import { TimePick } from '../../ui/pickers';

export default function PreferencesScreen() {
  const { state, run, account } = useApp();
  if (!state) return null;
  const p = state.preferences;
  const set = (patch: Partial<Preferences>) => void run((s, ctx) => updatePreferences(s, patch, ctx), { quiet: true });
  return (
    <Screen>
      <T variant="h1">Preferences</T>

      <SectionLabel>Planning</SectionLabel>
      <Card>
        <Choice label="Planning mode" value={p.planningMode} options={[{ value: 'auto', label: 'Automatic' }, { value: 'manual', label: 'I’ll plan myself' }]} onChange={(v) => set({ planningMode: v })} />
        <T variant="caption" color="textMuted">
          {p.planningMode === 'manual' ? 'You place sessions; NextStep checks for clashes, late work and overload.' : 'NextStep places sessions and explains each choice. You can pin or move any session.'}
        </T>
        <Choice label="Preferred session" value={p.defaultSessionMinutes} options={[25, 45, 60, 90].map((m) => ({ value: m, label: `${m} min` }))} onChange={(v) => set({ defaultSessionMinutes: v, maxSessionMinutes: Math.max(v, p.maxSessionMinutes) })} />
        <Choice label="Most study per day" value={p.dailyLimitMinutes} options={[60, 120, 180, 240, 300].map((m) => ({ value: m, label: `${m / 60} h` }))} onChange={(v) => set({ dailyLimitMinutes: v })} />
        <Choice label="Break between sessions" value={p.bufferMinutes} options={[5, 10, 15, 20].map((m) => ({ value: m, label: `${m} min` }))} onChange={(v) => set({ bufferMinutes: v })} />
        <Choice label="Finish before deadlines by" value={p.deadlineBufferHours} options={[0, 6, 12, 24].map((h) => ({ value: h, label: h === 0 ? 'No buffer' : `${h} h` }))} onChange={(v) => set({ deadlineBufferHours: v })} />
      </Card>

      <SectionLabel>Reminders</SectionLabel>
      <Card>
        <Toggle label="Session reminders" value={p.notifySessions} onChange={async (v) => { if (v) await notificationPermission(true); set({ notifySessions: v }); }} />
        <Toggle label="Deadline reminders" hint="The day before" value={p.notifyDeadlines} onChange={async (v) => { if (v) await notificationPermission(true); set({ notifyDeadlines: v }); }} />
        <Choice label="Remind me before a session" value={p.reminderLeadMinutes} options={[0, 10, 15, 30].map((m) => ({ value: m, label: m === 0 ? 'At start' : `${m} min` }))} onChange={(v) => set({ reminderLeadMinutes: v })} />
        <TimePick label="Quiet hours from" value={p.quietHoursStart} onChange={(v) => set({ quietHoursStart: v })} />
        <TimePick label="Quiet hours until" value={p.quietHoursEnd} onChange={(v) => set({ quietHoursEnd: v })} />
        <T variant="caption" color="textMuted">
          No reminders during quiet hours. Reminders are local to this phone and update whenever your plan changes.
        </T>
        <Button label="Refresh reminders now" small variant="ghost" onPress={async () => { const n = await rescheduleReminders(useApp.getState().state); useApp.getState().showToast(n ? `${n} reminders scheduled` : 'No reminders scheduled (check permission)'); }} />
      </Card>

      <SectionLabel>Accessibility & feel</SectionLabel>
      <Card>
        <Choice label="Theme" value={p.theme} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(v) => set({ theme: v })} />
        <Choice label="Motion" value={p.motion} options={[{ value: 'system', label: 'System' }, { value: 'reduce', label: 'Reduced' }, { value: 'full', label: 'Full' }]} onChange={(v) => set({ motion: v })} />
        <Toggle label="Haptics" value={p.haptics} onChange={(v) => set({ haptics: v })} />
        <Toggle label="Sounds" hint="Off by default" value={p.sound} onChange={(v) => set({ sound: v })} />
        <T variant="caption" color="textMuted">
          Text follows your phone’s font size setting.
        </T>
      </Card>

      <SectionLabel>Gamification</SectionLabel>
      <Card>
        <Toggle label="Steady weeks" hint="Weekly rhythm tracking. Missing a day never resets anything." value={p.streaksEnabled} onChange={(v) => set({ streaksEnabled: v })} />
        <Toggle label="Celebrations" hint="Badge and level-up pop-ups" value={p.celebrationsEnabled} onChange={(v) => set({ celebrationsEnabled: v })} />
        <Choice label="Active days I aim for each week" value={p.weeklyActiveDaysGoal} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} onChange={(v) => set({ weeklyActiveDaysGoal: v })} />
      </Card>

      {account?.mode === 'user' && (
        <>
          <SectionLabel>Data</SectionLabel>
          <Card>
            <Toggle label="Sync on mobile data" hint="Off: automatic sync waits for Wi-Fi (you can still sync manually)" value={p.syncOnCellular} onChange={(v) => set({ syncOnCellular: v })} />
          </Card>
        </>
      )}
      <Button label="Done" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
