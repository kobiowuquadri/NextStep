# Progress checklist

Mapped to the sections of the product brief. ✅ done and tested (automated or manual QA) · 🟡 done, not fully verified · ⏸ deferred · 🔑 needs external credentials/accounts. Evidence for every “tested” claim is in [TESTING.md](TESTING.md).

## Process (brief §25)

- ✅ 1 Inspect repository and design reference ([DESIGN_DIRECTION.md](DESIGN_DIRECTION.md))
- ✅ 2 Document scope, architecture and design system ([ARCHITECTURE.md](ARCHITECTURE.md), `packages/design-tokens`)
- ✅ 3 Shared models and scheduler tests (`packages/contracts`, `packages/scheduler`)
- ✅ 4 Mobile vertical slice (onboarding → plan → focus → check-in, on an Android emulator)
- ✅ 5 Recovery Mode and gamification
- ✅ 6 Backend persistence and offline sync
- ✅ 7 Remaining mobile screens and resources
- ✅ 8 Website and browser demo (built first, at the team’s request)
- ✅ 9 Functional, security and visual checks
- ✅ 10 Deployment and handoff documentation

## Deliverables (brief §2)

| Deliverable | Status |
|---|---|
| React Native app, Android first | ✅ Android: emulator QA in Expo Go and a locally built release APK (66.1 MB) · 🟡 iOS not built or tested |
| Responsive informative website | ✅ 9 pages + reset-password page, desktop and mobile e2e tests |
| Backend API and database | ✅ NestJS + PostgreSQL, integration tests on real PostgreSQL |
| Browser demo with fictional data and reset | ✅ `/demo/interactive` (and a narrated video of the real app at `/demo`) |
| Docs, env examples, seed data, deployment instructions | ✅ `README.md`, `docs/`, `.env.example` ×3, `prisma/seed.ts`, Dockerfile |
| Original brand and design system | ✅ tokens, mascot, illustrations, badges |

## Product areas

| Brief section | Status | Notes |
|---|---|---|
| §4 Illustrations, mascot, motion | ✅ | Code-drawn SVG; reduced motion respected; sound off by default |
| §7 Five tabs and all listed screens | ✅ | Every listed screen exists; empty/offline/error states on the main screens (see limitations for gaps) |
| §8 Onboarding | ✅ | 6 skippable steps; manual school/course entry. The fictional sample semester was removed from the app for real testers (11 Nov); it stays in the website demo |
| §9 Tasks | ✅ | All listed fields incl. dependencies, subtasks, splittable, online-only, resources |
| §10 Scheduling engine | ✅ | Deterministic, explained, shortfall options; manual/hybrid planning |
| §11 Recovery Mode | ✅ | 5 change types, before/after with reasons, accept/adjust/keep, stale-preview protection, undo |
| §12 Today dashboard | ✅ | ≤ 3 actions (never padded), completed-for-today, quick add, goal, sync badge |
| §13 Focus + learning checks | ✅ | Timestamp-persisted timer (survived force-stop on emulator), manual logging, check-in, practice checks |
| §14 Gamification | ✅ | Rules in [GAMIFICATION.md](GAMIFICATION.md); server-verified; idempotent |
| §15 Weekly reflection, personal goals | ✅ | Planned vs done, estimate vs actual, obstacles, restarts, suggestions; up to 2 goals |
| §16 Offline storage and sync | ✅ | [SYNC.md](SYNC.md) |
| §17 Backend and data model | ✅ | Prisma schema, migrations with CHECK constraints, OpenAPI |
| §18 AI features | 🟡 🔑 | Implemented with schema validation and fallback; tested with a stubbed provider only — no live provider call was made |
| §19 Learning resources | ✅ | 4 original resources, size shown before download, download/view/delete, not educator-reviewed |
| §20 Website | ✅ | All listed pages and home sections; real screenshots only |
| §21 Browser demo | ✅ | Guided steps, overloaded-week toggle, reset |
| §22 Accessibility, privacy, performance | ✅ / 🟡 | Labels, focus states, reduced motion, quiet hours, colour-independent status; screen-reader pass with TalkBack/VoiceOver **not** done |
| §23 Tests | ✅ | See [TESTING.md](TESTING.md) |
| §24 Tobi scenario | ✅ | Automated (`scenario.test.ts`, `mobile-sync.test.ts`) and manual on emulator |
| §26 Handoff | ✅ | This `docs/` folder |

## Deferred

- ⏸ Educator sharing (optional in the brief; not built, so no sharing surface exists).
- ⏸ Converting guest-mode data into a new account.
- ⏸ Push notifications from the server (local notifications are used).
- ⏸ iOS build and device QA.
- ⏸ Email verification.

## Needs external credentials or accounts (🔑)

- Hosting for API, database and website; domain and TLS.
- SMTP provider for password-reset email.
- Anthropic API key for optional AI suggestions.
- Expo account (EAS Build), Google Play Console, Apple Developer Program.
