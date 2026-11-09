import { AppState as RNAppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';
import { localDateKey, type AuthResponse, type SyncConflict } from '@nextstep/contracts';
import { buildTobiScenario } from '@nextstep/demo-data';
import {
  applyMutations,
  emptyState,
  newPreferences,
  recordAppOpen,
  refreshGoalTasks,
  type ActionError,
  type ActionResult,
  type AppState,
  type Ctx,
  type Mutation,
} from '@nextstep/engine';
import type { AchievementDef } from '@nextstep/gamification';
import { ApiError, authedRequest, NetworkError, publicRequest, tokenStore } from './api';
import { deleteAccountDb, getMeta, openAccountDb, setMeta, type Db } from './db';
import { rescheduleReminders, scheduleFocusEnd, cancelNotification, configureNotifications } from './notifications';
import { loadState, pendingCount, persist, replaceAll } from './repo';
import { backoffMs, isTransient, syncOnce } from './sync';
import { backToFocus, focusMs, newTimer, pause, resume, startBreak, type FocusTimer } from './timer';

export type AccountMode = 'user' | 'guest' | 'demo';
export interface Account {
  mode: AccountMode;
  userId: string;
  email?: string;
  displayName: string;
}

export type SyncStatus = 'local' | 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface Toast {
  id: number;
  text: string;
  tone: 'reward' | 'info' | 'warning';
}

interface Store {
  phase: 'booting' | 'signedOut' | 'needsFirstSync' | 'ready';
  account: Account | null;
  state: AppState | null;
  db: Db | null;
  deviceId: string;
  sync: { status: SyncStatus; pending: number; failed: number; lastSyncedAt: string | null; error: string | null; conflicts: SyncConflict[] };
  timer: FocusTimer | null;
  toast: Toast | null;
  celebrations: AchievementDef[];
  levelUp: number | null;
  online: boolean;

  boot(): Promise<void>;
  signUp(input: { email: string; password: string; displayName: string; timezone: string }): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  startGuest(displayName: string, timezone: string): Promise<void>;
  startDemo(): Promise<void>;
  signOut(opts?: { discardUnsynced?: boolean }): Promise<{ ok: true } | { ok: false; pending: number }>;
  deleteAccount(password: string): Promise<void>;
  retryFirstSync(): Promise<void>;
  run(fn: (s: AppState, ctx: Ctx) => ActionResult | ActionError, opts?: { batch?: boolean; basePlanRevision?: number; toast?: string; quiet?: boolean }): Promise<ActionResult | ActionError>;
  syncNow(reason?: string): Promise<void>;
  refreshSyncInfo(): Promise<void>;
  resolveConflict(id: string, choice: 'server' | 'client'): Promise<void>;
  showToast(text: string, tone?: Toast['tone']): void;
  dismissCelebration(): void;
  startTimer(p: { sessionId: string | null; taskId: string | null; label: string; workMinutes: number; breakMinutes: number }): Promise<void>;
  updateTimer(fn: (t: FocusTimer, now: number) => FocusTimer): Promise<void>;
  clearTimer(): Promise<{ focusMinutes: number; breaks: number; startedAt: number } | null>;
}

const ACCOUNT_KEY = 'ns.account';
const DEVICE_KEY = 'ns.device';
const accountDbKey = (a: Account) => (a.mode === 'user' ? a.userId : a.mode);
const ctxNow = (): Ctx => ({ now: Date.now(), newId: () => Crypto.randomUUID() });

let toastSeq = 0;
let syncing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;
let listenersReady = false;

export const useApp = create<Store>((set, get) => {
  const feedback = async (kind: 'success' | 'light') => {
    if (!get().state?.preferences.haptics) return;
    try {
      if (kind === 'success') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* haptics unavailable */
    }
  };

  const openFor = async (account: Account, seed?: (userId: string) => AppState) => {
    const db = await openAccountDb(accountDbKey(account));
    let state = await loadState(db, account.userId);
    if (!state && seed) {
      state = seed(account.userId);
      await replaceAll(db, state);
    }
    const timer = await getMeta<FocusTimer>(db, 'focusTimer');
    set({ db, account, state, timer, phase: state ? 'ready' : 'needsFirstSync' });
    await SecureStore.setItemAsync(ACCOUNT_KEY, JSON.stringify(account));
    if (state) await afterOpen();
  };

  const afterOpen = async () => {
    const { state } = get();
    if (!state) return;
    // Weekly goal top-up and a gentle "welcome back" (never a penalty).
    const refreshed = refreshGoalTasks(state, ctxNow());
    if (refreshed.mutations.length) await get().run(() => refreshed, { quiet: true });
    await get().run((s, c) => recordAppOpen(s, c), { quiet: false });
    await rescheduleReminders(get().state);
    await get().refreshSyncInfo();
    void get().syncNow('open');
  };

  const setupListeners = () => {
    if (listenersReady) return;
    listenersReady = true;
    RNAppState.addEventListener('change', (s) => {
      if (s === 'active') void get().syncNow('foreground');
    });
    NetInfo.addEventListener((info) => {
      const online = !!info.isConnected && info.isInternetReachable !== false;
      const was = get().online;
      set({ online });
      if (online && !was) void get().syncNow('reconnect');
    });
  };

  const sessionFrom = async (r: AuthResponse) => {
    await tokenStore.set(r.user.id, { accessToken: r.accessToken, refreshToken: r.refreshToken, accessTokenExpiresAt: r.accessTokenExpiresAt });
    return { mode: 'user' as const, userId: r.user.id, email: r.user.email, displayName: r.user.displayName };
  };

  return {
    phase: 'booting',
    account: null,
    state: null,
    db: null,
    deviceId: '',
    sync: { status: 'local', pending: 0, failed: 0, lastSyncedAt: null, error: null, conflicts: [] },
    timer: null,
    toast: null,
    celebrations: [],
    levelUp: null,
    online: true,

    async boot() {
      await configureNotifications().catch(() => undefined);
      let deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
      if (!deviceId) {
        deviceId = Crypto.randomUUID();
        await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
      }
      set({ deviceId });
      setupListeners();
      const raw = await SecureStore.getItemAsync(ACCOUNT_KEY);
      if (!raw) return set({ phase: 'signedOut' });
      const account = JSON.parse(raw) as Account;
      await openFor(account);
      if (get().phase === 'needsFirstSync') await get().retryFirstSync();
    },

    async retryFirstSync() {
      const { db, account } = get();
      if (!db || !account || account.mode !== 'user') return;
      try {
        set({ sync: { ...get().sync, status: 'syncing', error: null } });
        await syncOnce(db, account.userId, get().deviceId);
        const state = await loadState(db, account.userId);
        set({ state, phase: state ? 'ready' : 'needsFirstSync', sync: { ...get().sync, status: state ? 'synced' : 'error' } });
        if (state) await afterOpen();
      } catch (e) {
        set({ sync: { ...get().sync, status: e instanceof NetworkError ? 'offline' : 'error', error: (e as Error).message } });
      }
    },

    async signUp(input) {
      const r = await publicRequest<AuthResponse>('POST', '/v1/auth/register', { ...input, deviceId: get().deviceId });
      const account = await sessionFrom(r);
      await openFor(account);
      await get().retryFirstSync();
    },

    async signIn(email, password) {
      const r = await publicRequest<AuthResponse>('POST', '/v1/auth/login', { email, password, deviceId: get().deviceId });
      const account = await sessionFrom(r);
      await openFor(account);
      await get().retryFirstSync();
    },

    async startGuest(displayName, timezone) {
      const userId = Crypto.randomUUID();
      await openFor({ mode: 'guest', userId, displayName }, (id) => emptyState(id, newPreferences(id, displayName, timezone, Date.now())));
    },

    async startDemo() {
      // Fictional sample semester; local only, never synced.
      await openFor({ mode: 'demo', userId: 'demo-tobi', displayName: 'Tobi (sample)' }, () => buildTobiScenario(Date.now()));
    },

    async signOut(opts = {}) {
      const { db, account } = get();
      if (!account) return { ok: true };
      if (account.mode === 'user' && db) {
        const { pending, failed } = await pendingCount(db);
        if (pending + failed > 0 && !opts.discardUnsynced) return { ok: false, pending: pending + failed };
        const tokens = await tokenStore.get(account.userId);
        if (tokens) await authedRequest(account.userId, 'POST', '/v1/auth/logout', { refreshToken: tokens.refreshToken }).catch(() => undefined);
        await tokenStore.clear(account.userId);
      }
      await rescheduleReminders(null);
      await deleteAccountDb(db, accountDbKey(account));
      await SecureStore.deleteItemAsync(ACCOUNT_KEY);
      set({ phase: 'signedOut', account: null, state: null, db: null, timer: null, sync: { status: 'local', pending: 0, failed: 0, lastSyncedAt: null, error: null, conflicts: [] } });
      return { ok: true };
    },

    async deleteAccount(password) {
      const { account } = get();
      if (!account) return;
      if (account.mode === 'user') await authedRequest(account.userId, 'DELETE', '/v1/me', { password, confirm: 'DELETE' });
      await get().signOut({ discardUnsynced: true });
    },

    async run(fn, opts = {}) {
      const { state, db, account } = get();
      if (!state || !db || !account) return { error: 'INVALID', reason: 'Not ready' };
      const result = fn(state, ctxNow());
      if ('error' in result) return result;
      if (result.mutations.length === 0) return result;
      await persist(db, result.mutations as Mutation[], { sync: account.mode === 'user', batch: opts.batch, basePlanRevision: opts.basePlanRevision });
      set({ state: result.state });
      const xp = result.awards.reduce((a, w) => a + w.entry.xp, 0);
      const capped = result.awards.some((w) => w.result === 'capped');
      if (!opts.quiet) {
        if (xp > 0) get().showToast(`+${xp} XP${opts.toast ? ` · ${opts.toast}` : ''}${capped ? ' · daily XP limit reached' : ''}`, 'reward');
        else if (capped) get().showToast(`${opts.toast ? `${opts.toast} · ` : ''}Daily XP limit reached — your progress still counts`);
        else if (opts.toast) get().showToast(opts.toast);
        void feedback(xp > 0 ? 'success' : 'light');
      }
      if (result.unlocked.length && state.preferences.celebrationsEnabled) set({ celebrations: [...get().celebrations, ...result.unlocked] });
      if (result.levelUp && state.preferences.celebrationsEnabled) set({ levelUp: result.levelUp.to });
      if (result.mutations.some((m) => m.entity === 'session' || m.entity === 'task' || m.entity === 'preferences')) void rescheduleReminders(get().state);
      if (account.mode === 'user') {
        await get().refreshSyncInfo();
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void get().syncNow('write'), 2500);
      }
      return result;
    },

    async refreshSyncInfo() {
      const { db, account } = get();
      if (!db || !account) return;
      if (account.mode !== 'user') return set({ sync: { ...get().sync, status: 'local' } });
      const counts = await pendingCount(db);
      const lastSyncedAt = await getMeta<string>(db, 'lastSyncedAt');
      const conflicts = (await db.getAllAsync<{ data: string }>(`SELECT data FROM conflicts WHERE status = 'open'`)).map((r) => JSON.parse(r.data) as SyncConflict);
      set({ sync: { ...get().sync, ...counts, lastSyncedAt, conflicts } });
    },

    async syncNow(reason) {
      const { db, account, state } = get();
      if (!db || !account || account.mode !== 'user' || syncing) return;
      if (state && !state.preferences.syncOnCellular && reason !== 'manual') {
        const info = await NetInfo.fetch();
        if (info.type === 'cellular') return set({ sync: { ...get().sync, status: 'idle', error: 'Waiting for Wi-Fi (your data-saver setting).' } });
      }
      syncing = true;
      // Background retries keep the badge steady ("Offline · 2 waiting") instead of flickering to "Syncing…".
      const quietRetry = reason === 'retry' && (get().sync.status === 'offline' || get().sync.status === 'error');
      if (!quietRetry) set({ sync: { ...get().sync, status: 'syncing', error: null } });
      try {
        const outcome = await syncOnce(db, account.userId, get().deviceId);
        attempt = 0;
        const next = await loadState(db, account.userId);
        if (next) set({ state: next });
        await get().refreshSyncInfo();
        set({ sync: { ...get().sync, status: 'synced', error: outcome.failed ? `${outcome.failed} change(s) could not be saved. Review them in Sync.` : null } });
        if (outcome.pulled > 0) void rescheduleReminders(get().state);
      } catch (e) {
        const transient = isTransient(e);
        set({ sync: { ...get().sync, status: e instanceof NetworkError ? 'offline' : 'error', error: e instanceof ApiError && e.status === 401 ? 'Please sign in again to sync.' : (e as Error).message } });
        if (transient) {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => void get().syncNow('retry'), backoffMs(attempt++));
        }
      } finally {
        syncing = false;
      }
    },

    async resolveConflict(id, choice) {
      const { db, account } = get();
      if (!db || !account || account.mode !== 'user') return;
      await authedRequest(account.userId, 'POST', `/v1/sync/conflicts/${id}/resolve`, { choice });
      await db.runAsync(`UPDATE conflicts SET status = 'resolved' WHERE id = ?`, id);
      await get().syncNow('manual');
    },

    showToast(text, tone = 'info') {
      const id = ++toastSeq;
      set({ toast: { id, text, tone } });
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 3500);
    },

    dismissCelebration() {
      if (get().celebrations.length > 0) set({ celebrations: get().celebrations.slice(1) });
      else set({ levelUp: null });
    },

    async startTimer(p) {
      const { db } = get();
      if (!db) return;
      const t = newTimer(p, Date.now());
      t.notificationId = await scheduleFocusEnd(Date.now() + p.workMinutes * 60_000, p.label);
      await setMeta(db, 'focusTimer', t);
      set({ timer: t });
    },

    async updateTimer(fn) {
      const { db, timer } = get();
      if (!db || !timer) return;
      const now = Date.now();
      const next = fn(timer, now);
      await cancelNotification(timer.notificationId);
      next.notificationId = next.runningSince && next.phase === 'focus' ? await scheduleFocusEnd(now + Math.max(0, next.workMinutes * 60_000 - (focusMs(next, now) % (next.workMinutes * 60_000))), next.label) : null;
      await setMeta(db, 'focusTimer', next);
      set({ timer: next });
    },

    async clearTimer() {
      const { db, timer } = get();
      if (!db || !timer) return null;
      const now = Date.now();
      await cancelNotification(timer.notificationId);
      await db.runAsync('DELETE FROM meta WHERE key = ?', 'focusTimer');
      set({ timer: null });
      return { focusMinutes: Math.round(focusMs(timer, now) / 60_000), breaks: timer.breaks, startedAt: timer.startedAt };
    },
  };
});

export const timerActions = { pause, resume, startBreak, backToFocus };

/** Today's local date key for the active account. */
export function todayKey(state: AppState): string {
  return localDateKey(Date.now(), state.preferences.timezone);
}

export { applyMutations };
