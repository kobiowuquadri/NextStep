# Offline-first sync

Code: client `apps/mobile/src/lib/{db,repo,sync,store}.ts`; server `apps/api/src/sync/*`; protocol schemas `packages/contracts/src/sync.ts`. Tests: `apps/api/test/api.test.ts` (sync, conflicts, isolation) and `apps/api/test/mobile-sync.test.ts`, which runs the **real mobile sync modules** (on Node’s SQLite) against the real API and PostgreSQL.

## Goals

- Everything a student does works offline: tasks, planning, Recovery Mode, focus, check-ins, XP, reflections, goals, downloaded resources.
- Nothing typed offline is lost, duplicated or silently overwritten.
- Two devices editing the same data converge, and real disagreements are shown to the student.
- One account’s data never reaches another account on the same phone.

## Local storage (phone)

One SQLite database **per account** (`nextstep-<userId>.db`; guest and sample-semester modes get their own files):

| Table | Purpose |
|---|---|
| `records(entity, id, data JSON, rev, deleted)` | Current copy of every record. `rev` is the last server revision seen (null = never synced). |
| `outbox(seq, op_id, entity, entity_id, kind, data, changed_fields, base_rev, batch_id, base_plan_revision, status, attempts, last_error)` | Pending operations in order. |
| `meta` | Pull cursor, device ID, last sync time, focus timer state. |
| `conflicts` | Conflicts reported by the server, until resolved. |
| `downloads` | Downloaded learning resources. |

Every user action is an engine action producing **mutations**; `persist()` writes records and outbox rows in **one SQLite transaction**, so a crash can’t leave a change saved without its upload entry (or vice versa).

**Outbox coalescing**: a second edit to a record that hasn’t been sent yet is merged into the existing pending op (union of changed fields, latest data); deleting it turns that pending op into a single delete. Ops that belong to a batch are never coalesced.

## Protocol

### Records

Every synced record has `id` (client-generated UUID), `rev` (per-user revision when last changed on the server), `updatedAt`, `deletedAt` (tombstone). On the server each row also stores `fieldRevs` (the revision at which each field last changed).

### Push — `POST /v1/sync/push`

```json
{ "deviceId": "…", "ops": [ { "opId": "uuid", "entity": "task", "entityId": "uuid", "kind": "upsert",
  "baseRev": 41, "changedFields": ["remainingMinutes"], "data": { … }, "clientTime": "…",
  "batchId": "uuid?", "basePlanRevision": 3 } ] }
```

Up to 200 ops per request. The client sends ops in order, **never two ops for the same record in one request** and **whole batches only**.

Server processing (`SyncService.push`):

1. **Per-user advisory lock** (`pg_advisory_xact_lock`) so revisions are allocated in commit order and a pull never sees a gap.
2. **Idempotency**: each `opId` is stored in `SyncOperation` with its result. A retried op (lost response, app killed mid-request) returns the original result as `duplicate` — nothing is applied twice.
3. **Ownership**: an op touching a record that belongs to another user is rejected (`FORBIDDEN`) — IDs from another account can’t be overwritten.
4. **Dependency order**: ops are applied parents first (course → task → subtask → plan revision → session …) so a batch created offline in any order still applies.
5. **Batches** (`batchId`, e.g. accepting a recovery plan): all ops commit in one database transaction or none do (`BATCH_REJECTED:<reason>`).
6. **Validation** with the same Zod schemas as the client, plus parent checks (`PARENT_NOT_FOUND`, `PARENT_DELETED`).
7. Each op returns `applied`, `merged`, `duplicate`, `conflict` or `rejected` with the new `rev` and, where the server’s copy differs, the merged record.

### Pull — `GET /v1/sync/pull?cursor=N&limit=500`

Returns records and tombstones with `rev > cursor`, oldest first, plus open/resolved conflicts, the new cursor and `hasMore`. Deleted records come back as tombstones (`DeletionMarker` keeps hard-deleted ones). Pulls are paginated and each page is applied locally in one transaction together with the new cursor, so an interrupted pull resumes cleanly.

A record with pending local changes is **not** overwritten by a pull; the pending op is merged by the server on push.

## Conflict rules

| Situation | Result |
|---|---|
| Same record, **different fields** changed on two devices | Auto-merged field by field (`merged`). |
| Same field, same value | No-op (`duplicate`). |
| Same **unimportant** field (e.g. title, notes, colour) | Last write wins, in server commit order. |
| Same **important** field with different values — task `dueAt`/`estimatedMinutes`/`remainingMinutes`, session `startAt`/`endAt`/`status`, availability and commitment times, day override limits, goal weekly target | The server keeps its value, **stores a conflict with both values**, and the student chooses on the Sync screen (“Use this phone’s version” / “Use the other device’s version”). |
| Two devices apply **different plan changes** on the same base revision (e.g. both accept a Recovery Mode proposal offline) | Plan revisions carry `basePlanRevision`; `(userId, number)` is unique. The second batch is rejected as a whole with `STALE_PLAN`, a conflict is recorded, the phone re-pulls the current plan, and the student can **keep the other device’s plan** or **rebuild from their changes** (opens Recovery Mode on top of the current plan). |
| Edit to a record **deleted** on another device | `RECORD_DELETED`: the deletion wins, the phone tombstones its copy and drops later queued edits for it. |
| Append-only records (focus logs, goal check-ins, XP events, achievements) | Never conflict; the first write wins and replays are duplicates. |
| XP events | Recomputed and verified by the server — see [GAMIFICATION.md](GAMIFICATION.md). Duplicates return the confirmed event; unverifiable ones are marked rejected locally. |

After a successful op the client **rebases** later queued edits of the same record onto the new `rev`, so a long offline session doesn’t self-conflict.

## When sync runs

- 2.5 s after any local change (debounced), when the app comes to the foreground, when connectivity returns (NetInfo), and from “Sync now”.
- Optional “sync on Wi-Fi only” preference.
- Transient failures (network, 5xx, 429) retry with exponential backoff and jitter: 2 s, 4 s, 8 s … max 60 s. Ops stay pending.
- Ops the server rejects permanently are marked **failed** and kept; the Sync screen shows them with the reason and a **Discard** button — they are never silently dropped.

## Sync status shown to the student

Header badge and Profile → Sync: *Saved on this phone* (guest/sample), *Synced*, *Syncing…*, *N changes waiting* (offline), *Needs attention* (conflicts or failed ops), with the last sync time.

## Accounts, logout and isolation

- Each account has its own database file; switching accounts never mixes data. Tests cover two users on one device (`mobile-sync.test.ts`) and cross-user writes on the server.
- **Sign out with unsynced work**: the app counts pending + failed ops and refuses to sign out until the student either syncs or explicitly confirms discarding them.
- Sign out revokes the refresh token on the server, deletes tokens from SecureStore, cancels reminders and deletes that account’s local database file.
- Guest and sample-semester data never sync. Converting a guest’s local data into a new account is **not implemented** (see [LIMITATIONS.md](LIMITATIONS.md)).

## Security limitations of local data

- Tokens are in platform secure storage (Android Keystore / iOS Keychain via `expo-secure-store`).
- The SQLite database itself is **not encrypted**; it relies on the operating system’s per-app sandbox and device encryption. A rooted/jailbroken device or an unencrypted backup could expose it. SQLCipher is a possible future addition.
- `allowBackup` behaviour follows Expo defaults; review before release if students’ task text is considered sensitive.

## Measured payload sizes

Measured against the local API with `apps/api/scripts/measure-sync.ts` (fictional Tobi semester, gzip on responses):

| Workflow | Upload | Download |
|---|---|---|
| Full sample semester upload (53 ops) | 28.6 KB (request not compressed) | — |
| Fresh phone full download | — | 4.6 KB gzip (25.1 KB uncompressed) |
| Edit one task | ~0.9 KB | ~0.8 KB |
| Incremental pull after one edit | — | ~0.6 KB |
| Accept a recovery plan (33 ops) | 21.7 KB | 1.1 KB |

These are localhost measurements of payload bytes, not field measurements on a mobile network; HTTP/TLS overhead is extra. Request bodies are not compressed by the client.
