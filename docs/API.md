# API overview

NestJS REST API, versioned under `/v1`. The full, generated OpenAPI 3.1 document is served at **`/docs/openapi.json`** and rendered at **`/docs`** (both generated from the shared Zod contracts, so they match what the server validates).

- JSON only, request bodies ≤ 1 MB, responses gzip-compressed above 1 KB.
- Every route needs `Authorization: Bearer <access token>` unless marked public.
- Every response carries `X-Request-Id` (also accepted from the client) for support/log correlation.
- Errors: `{ "error": { "code": "VALIDATION_FAILED", "message": "…", "requestId": "…", "details": [...] } }`. Codes: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `NOT_FOUND`, `FORBIDDEN`, `RATE_LIMITED`, `STALE_PREVIEW`, `CONFLICT`, `AI_NOT_CONFIGURED`, `AI_UNAVAILABLE`, `AI_LIMIT_REACHED`, `INTERNAL`.
- Rate limits: 120 requests/min per client by default; auth routes 20/min (reset request 5/min, reset confirm 10/min, refresh 30/min, export/delete 5/min).

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Public. Checks the database; returns `{ status, db, aiConfigured, version, time }` (503 if the database is unreachable). |

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/auth/register` | Public. `{ email, password (≥ 10 chars), displayName, timezone }` → user + tokens. |
| POST | `/v1/auth/login` | Public. Same generic error for unknown email and wrong password. |
| POST | `/v1/auth/refresh` | Public. Rotates the refresh token; reusing an old one revokes the whole token family. |
| POST | `/v1/auth/logout` | Revokes the given refresh token. |
| POST | `/v1/auth/password-reset/request` | Public. Always returns 202 (no account enumeration). Emails a 30-minute single-use link when SMTP is configured. |
| POST | `/v1/auth/password-reset/confirm` | Public. `{ token, newPassword }`; revokes all sessions on success. |
| GET | `/v1/auth/session` | Current user from the access token. |

Access tokens: HS256 JWT, 15 min. Refresh tokens: opaque random 256-bit values, stored as SHA-256 hashes, 30 days, rotated on every use. Passwords: Argon2id.

## Account

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/me` | Profile and preferences. |
| PATCH | `/v1/me/preferences` | Partial preferences update (validated). |
| GET | `/v1/me/export` | Full JSON export of the student’s data. |
| DELETE | `/v1/me` | `{ password, confirm: "DELETE" }` — deletes the account and all data (cascade). |

## Sync

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/sync/push` | Up to 200 idempotent ops. See [SYNC.md](SYNC.md). |
| GET | `/v1/sync/pull?cursor=&limit=` | Changes and tombstones since the cursor, plus conflicts. |
| POST | `/v1/sync/conflicts/:id/resolve` | `{ choice: "server" \| "client" }`. |

## Collections (REST CRUD)

`GET /v1/:collection` (cursor-paginated by revision: `limit` ≤ 200, `cursor`, `updatedSince`, `includeDeleted`), `GET /v1/:collection/:id`, `POST /v1/:collection`, `PATCH /v1/:collection/:id` (optional `If-Match: <rev>` for optimistic concurrency), `DELETE /v1/:collection/:id` (tombstone).

Collections: `preferences`, `semesters`, `courses`, `tasks`, `subtasks`, `availability`, `commitments`, `day-overrides`, `sessions`, `focus-logs`, `reflections`, `goals`, `goal-checkins`, `resource-progress` (read/write) and `plan-revisions`, `recovery-proposals`, `events` (XP ledger), `achievements` (read-only over REST — they change through planning/recovery endpoints or sync). Writes go through the sync engine, so validation, ownership, revisions and conflict rules are identical to sync.

## Planning and Recovery Mode

These run the shared engine on the server against the student’s stored data.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/today` | Next actions, today’s progress, deadlines, missed sessions. |
| POST | `/v1/planning/preview` | Proposed plan with explanations and shortfall options; changes nothing. |
| POST | `/v1/planning/generate` | Applies a new plan as a new plan revision. |
| POST | `/v1/recovery/preview` | Body: a `RecoveryInput` (`missed_session`, `less_time`, `deadline_changed`, `urgent`, `lighter_day`). Returns before/after, changes with reasons, next step, at-risk tasks, `baseRevision` and `fingerprint`. |
| POST | `/v1/recovery/accept` | `{ input, baseRevision, fingerprint }`. Rebuilds the proposal and refuses stale ones (`409 STALE_PREVIEW`). Applies everything atomically. |
| POST | `/v1/recovery/keep` | Records “keep current plan”; nothing else changes. |
| GET | `/v1/progress` | XP, level, steady weeks, quests, achievements, cosmetics. |
| GET | `/v1/reflection/current` | This week’s summary for the reflection screen. |

## Learning resources

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/resources` | Public. Sample learning resources with size, provenance and review status. |
| GET | `/v1/resources/:id` | Public. Full content. |

## Optional AI assistance

Disabled unless `ANTHROPIC_API_KEY` is set on the server (`503 AI_NOT_CONFIGURED` otherwise). Clients treat every AI response as a **suggestion the student must confirm**; nothing is saved automatically.

| Method | Path | Body → result |
|---|---|---|
| POST | `/v1/ai/breakdown` | `{ title, description?, kind?, estimatedMinutes? }` → 1–10 suggested steps with minutes. |
| POST | `/v1/ai/capture` | `{ text, timezone, now, courseTitles? }` → a task draft (title, kind, due date only if stated, estimate, course, importance) plus the points the student must confirm. |
| POST | `/v1/ai/availability` | `{ text, timezone, now }` → a structured reading of “I only have an hour tonight” (`less_time` / `lighter_day` / `urgent` / `unclear`) that pre-fills Recovery Mode for review. |

Safeguards: per-user daily quota (`AI_DAILY_LIMIT_PER_USER`, default 20), 20 s timeout, one retry, inputs length-limited, the provider is instructed to treat the student’s text purely as data, and every response is re-validated against the contract schema. Refusals, timeouts, provider errors and invalid output all return `503 AI_UNAVAILABLE` and the client continues with manual entry. Only the feature name and error type are logged, never the student's text.
