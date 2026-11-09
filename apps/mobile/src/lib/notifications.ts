import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { formatTimeOfDay, parseHHMM, zonedParts } from '@nextstep/contracts';
import { live, type AppState } from '@nextstep/engine';
import { currentSessionLabels } from '@nextstep/scheduler';

const CHANNEL = 'reminders';
let configured = false;

export async function configureNotifications() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Study reminders',
      description: 'Upcoming sessions and deadlines',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 120],
    });
  }
}

export async function notificationPermission(request = false): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!request) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/** True when a wall-clock minute-of-day falls inside quiet hours (which may wrap midnight). */
export function inQuietHours(ms: number, tz: string, start: string, end: string): boolean {
  const p = zonedParts(ms, tz);
  const m = p.hour * 60 + p.minute;
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  return s <= e ? m >= s && m < e : m >= s || m < e;
}

/** Reminders NextStep would schedule for this state. Pure, so it can be tested. */
export function plannedReminders(state: AppState, now: number): Array<{ at: number; title: string; body: string }> {
  const p = state.preferences;
  const tz = p.timezone;
  const out: Array<{ at: number; title: string; body: string }> = [];
  const horizon = now + 7 * 86_400_000;
  const title = (id: string) => state.tasks.find((t) => t.id === id)?.title ?? 'Study session';
  if (p.notifySessions) {
    const labels = currentSessionLabels(live(state.sessions), live(state.subtasks), now);
    for (const s of live(state.sessions)) {
      if (s.status !== 'planned') continue;
      const at = Date.parse(s.startAt) - p.reminderLeadMinutes * 60_000;
      if (at <= now || at > horizon) continue;
      out.push({ at, title: `Next: ${(labels.has(s.id) ? labels.get(s.id) : s.label) ?? title(s.taskId)}`, body: `${s.minutes} min at ${formatTimeOfDay(Date.parse(s.startAt), tz)}. You’ve got this.` });
    }
  }
  if (p.notifyDeadlines) {
    for (const t of live(state.tasks)) {
      if (!t.dueAt || t.status === 'done' || t.status === 'archived') continue;
      const at = Date.parse(t.dueAt) - 24 * 3_600_000;
      if (at <= now || at > horizon) continue;
      out.push({ at, title: `Due tomorrow: ${t.title}`, body: `Due ${formatTimeOfDay(Date.parse(t.dueAt), tz)}. Open NextStep to see your next step.` });
    }
  }
  return out
    .filter((r) => !inQuietHours(r.at, tz, p.quietHoursStart, p.quietHoursEnd))
    .sort((a, b) => a.at - b.at)
    .slice(0, 40);
}

/** Replace all scheduled reminders. Called after every plan change, so reminders follow the plan. */
export async function rescheduleReminders(state: AppState | null): Promise<number> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!state || !(await notificationPermission(false))) return 0;
    const reminders = plannedReminders(state, Date.now());
    for (const r of reminders) {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, data: {} },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at), channelId: CHANNEL },
      });
    }
    return reminders.length;
  } catch {
    return 0;
  }
}

export async function scheduleFocusEnd(at: number, label: string): Promise<string | null> {
  try {
    if (!(await notificationPermission(false))) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Focus block done', body: `${label} — time for a proper break.`, data: {} },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: CHANNEL },
    });
  } catch {
    return null;
  }
}

export async function cancelNotification(id: string | null | undefined) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}
