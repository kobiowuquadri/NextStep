# Architecture

NextStep is a **modular monolith**: one API process, one database, two clients, and shared TypeScript packages that hold the business rules. There are no microservices or queues — the workload is small per student and the hard problems are correctness and offline behaviour, not scale.

```
                ┌───────────────────────── packages/ (pure TypeScript) ─────────────────────────┐
                │ contracts → scheduler → gamification → engine ← demo-data   design-tokens     │
                │   (Zod)     (planner,    (XP, quests,   (domain     (Tobi,      illustrations    │
                │             Recovery)    badges)        actions)   resources)  (SVG strings)    │
                └───────────────┬─────────────────────────┬─────────────────────────┬───────────┘
                                │                         │                         │
                 ┌──────────────▼─────────┐   ┌───────────▼────────────┐  ┌─────────▼──────────┐
                 │ apps/mobile (Expo)      │   │ apps/api (NestJS)       │  │ apps/web (Next.js) │
                 │ SQLite store + outbox   │◄─►│ REST + /v1/sync         │  │ site + /demo        │
                 │ local notifications     │   │ Prisma → PostgreSQL     │  │ demo: localStorage  │
                 └─────────────────────────┘   └─────────────────────────┘  └────────────────────┘
```

## Shared packages

| Package | Responsibility |
|---|---|
| `contracts` | Zod schemas for every entity, the sync protocol (`SyncOp`, push/pull, conflicts), API DTOs and error codes; Intl-based timezone helpers (work on Node, browsers and Hermes); `stableUuid` for deterministic IDs. |
| `scheduler` | Deterministic planner (`generatePlan`), shortfall options, manual-plan analysis, Recovery Mode proposals with before/after diffs, Today view. No I/O, injected clock. |
| `gamification` | XP rules with dedupe keys and daily caps, level curve, steady weeks, quests, achievements, cosmetic unlocks, ledger reconciliation. |
| `engine` | Pure domain actions over an in-memory `AppState` (create/update/delete, generate plan, accept/undo recovery, log focus, reflections, goals…). Each returns the new state **plus a list of record mutations** that the caller persists and syncs. Awards, quests and achievements are evaluated in one place. |
| `design-tokens` | Palette and semantic light/dark tokens (contrast-tested), type scale, spacing, motion; emits `tokens.css` for the web. |
| `illustrations` | The original mascot “Nex” (7 poses, 6 skins, 7 accessories), scenes and badges as SVG strings, rendered by `react-native-svg` on mobile and inline on the web. |
| `demo-data` | The fictional Tobi scenario (built relative to “now”) and four original sample learning resources. Imported only by demo/sample code paths and the opt-in seed. |

## Mobile app (`apps/mobile`)

- **Expo SDK 58 / React Native 0.88**, Expo Router with five tabs (Today, Plan, Focus, Journey, Profile) plus modal routes for Recovery and Check-in and stack routes for tasks, goals, reflection, resources, settings and sync.
- **State**: one Zustand store (`src/lib/store.ts`) holds the account, the in-memory `AppState`, sync status, the focus timer and UI overlays. Every change goes through `run(action)`: engine action → `persist()` (one SQLite transaction writing records + outbox) → state update → feedback (toast, haptics, celebrations) → reminders rescheduled → debounced sync.
- **Persistence**: one SQLite file per account (`nextstep-<userId>.db`, `-guest`, `-demo`) with `records` (JSON documents), `outbox`, `meta`, `conflicts`, `downloads`. Tokens live in SecureStore (Android Keystore / iOS Keychain).
- **Sync**: `src/lib/sync.ts` — see [SYNC.md](SYNC.md).
- **Notifications**: local only (`expo-notifications`), rescheduled whenever the plan changes, respecting quiet hours. Remote push is not used.
- **Focus timer**: stored as timestamps in SQLite, so it survives navigation, backgrounding and process death.
- **Modes**: signed-in account (syncs), guest (this phone only), sample semester (fictional Tobi, this phone only).

## API (`apps/api`)

- **NestJS 12** (ESM), Express adapter, global `AuthGuard` (JWT access tokens + rotating opaque refresh tokens), `ThrottlerGuard`, structured error filter, access-log interceptor that never logs bodies, Helmet, CORS allow-list, gzip.
- **Validation** with the shared Zod schemas (`parse()` helper) — the same schemas the clients use.
- **Prisma 7** with the `pg` driver adapter. Every user-owned table has `rev` (per-user sync revision), `fieldRevs` (per-field revision for conflict detection) and `deletedAt` (tombstone). See `prisma/schema.prisma`.
- **Sync service** applies operations idempotently under a per-user advisory lock, in dependency order, with atomic batches. Generic REST CRUD (`/v1/:collection`) goes through the same code path.
- **Planning/Recovery endpoints** load the student’s state and run the same engine actions server-side; Recovery acceptance re-derives the proposal and refuses stale previews.
- **Optional AI** (`/v1/ai/*`) via the Anthropic SDK with schema-constrained outputs; disabled without a key.
- **Docs**: OpenAPI 3.1 generated from the Zod contracts at `/docs/openapi.json`, rendered at `/docs`.

## Website (`apps/web`)

- **Next.js 16** App Router, all pages statically prerendered, CSS Modules on top of the generated design tokens, Lucide icons, `next/font` for Bricolage Grotesque + Plus Jakarta Sans.
- **Demo video** (`/demo`): a narrated walkthrough of the real Android app, built from emulator footage with the Remotion project in `video/` (see its README).
- **Browser demo** (`/demo/interactive`): a client-only app using the same engine/scheduler/gamification packages, with fictional data, a simulated Lagos clock, `localStorage` persistence and a reset button. It never talks to the API.

## Key decisions

- **Local-first**: the phone is the primary copy for a student; the server is the sync hub and backup. Planning, Recovery Mode and XP work fully offline.
- **Deterministic planning** instead of AI planning: explainable, testable, offline, free to run. AI is optional assistance only.
- **One rules implementation** shared by app, demo and server so they can’t drift.
- **Document-style local storage** (JSON per record in SQLite) because per-student data is small (hundreds of records) and it keeps the client sync layer generic; the server uses relational tables with constraints.
