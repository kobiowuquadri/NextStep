# NextStep

**Plans change. Keep moving.** — by Team Apex

NextStep helps students organise coursework, build realistic study plans and recover when life disrupts them. Its signature feature is **Recovery Mode**: tap *“My plans changed”*, review a feasible before/after proposal with a smaller next step, and choose what to accept.

It is built first for Nigerian tertiary and distance-learning students balancing study with work, commuting, family duties and limited data — and works for students anywhere.

| Part | What it is | Where |
|---|---|---|
| Mobile app | React Native / Expo (SDK 58) app for Android (first) and iOS. Offline-first with SQLite and sync. | `apps/mobile` |
| Website | Next.js 16 informative site, a **narrated demo video** of the real app (`/demo`) and an interactive **browser demo** with fictional data (`/demo/interactive`) | `apps/web` |
| Demo video | Remotion project that turns real app footage, motion graphics and a synthetic narration voice into the `/demo` video | `video` |
| API | NestJS 12 + PostgreSQL (Prisma 7) REST API with offline sync | `apps/api` |
| Shared logic | Contracts (Zod), deterministic scheduler, gamification rules, domain engine, design tokens, illustrations, demo data | `packages/*` |

The scheduler, Recovery Mode and gamification rules live in shared packages and are exercised identically by the mobile app, the API and the browser demo.

> Status: implemented and tested locally. Not yet deployed or published to app stores. See [docs/TESTING.md](docs/TESTING.md) for exactly what was verified and what wasn’t.

---

## Repository layout

```
apps/
  api/        NestJS API, Prisma schema + migrations, seed, Dockerfile, integration tests
  mobile/     Expo Router app (5 tabs), SQLite store, outbox sync, local notifications
  web/        Next.js site (9 pages), /demo video page, /demo/interactive browser demo, Playwright e2e tests
packages/
  contracts/      Zod schemas: entities, sync protocol, API DTOs, timezone helpers
  scheduler/      Deterministic planner, shortfall options, Recovery Mode, Today view
  gamification/   XP rules, caps, levels, quests, achievements, cosmetics
  engine/         Pure domain actions (create task, accept recovery, log focus…) → mutations
  design-tokens/  Palette, semantic light/dark tokens, type scale (+ generated CSS)
  illustrations/  Original code-drawn mascot "Nex", scenes, badges (SVG strings)
  demo-data/      Fictional "Tobi" scenario + original sample learning resources
docs/            Architecture, design direction, scheduler, gamification, sync, deployment, testing…
```

## Requirements

- Node.js 22.12+ (developed on Node 24) and pnpm 11 (`corepack enable`)
- PostgreSQL 15+ with UTF-8 encoding — via Docker Compose, **or** the bundled embedded PostgreSQL script (no Docker needed)
- For Android: Android Studio emulator or a phone with **Expo Go (SDK 58)**; for release builds, JDK 17 + Android SDK, or EAS Build

## Local setup

```bash
pnpm install
pnpm build:packages                      # compile shared packages (required before running apps)

# 1. Database — pick one
docker compose up -d db                  # PostgreSQL on localhost:54329
# or, without Docker:
pnpm --filter @nextstep/api db:embedded  # embedded PostgreSQL on localhost:54329 (leave running)

# 2. API
cp apps/api/.env.example apps/api/.env   # set JWT_SECRET (openssl rand -base64 48)
pnpm --filter @nextstep/api prisma:generate
pnpm db:migrate                          # prisma migrate deploy
pnpm db:seed                             # achievements + sample resources (demo account is opt-in)
pnpm dev:api                             # http://localhost:4000  · API docs at /docs

# 3. Website + browser demo
cp apps/web/.env.example apps/web/.env.local
pnpm dev:web                             # http://localhost:3000  · video at /demo, interactive demo at /demo/interactive

# 4. Mobile app
cp apps/mobile/.env.example apps/mobile/.env   # EXPO_PUBLIC_API_URL (emulator: http://10.0.2.2:4000)
pnpm dev:mobile                          # then press "a" for Android, or scan the QR code in Expo Go
```

The website demo and the mobile app's **guest mode** need no API at all. The tester APK talks to the live API (`apps/mobile/eas.json`, `preview` profile).

## Tests

```bash
pnpm test:packages                       # 95 unit tests: contracts, tokens, illustrations, scheduler, gamification, engine, demo scenario
pnpm test:api                            # 42 API + offline-sync integration tests on a throwaway PostgreSQL
pnpm build:web && pnpm test:web          # 50 Playwright e2e tests (desktop + Pixel 7)
                                         # no bundled Playwright browser? add E2E_CHANNEL=chrome
pnpm check:secrets                       # no server secrets in client code or bundles
pnpm typecheck

# Measurements
API_URL=http://localhost:4000 npx tsx apps/api/scripts/measure-sync.ts   # sync payload sizes (API running)
node apps/web/scripts/measure-web.mjs http://localhost:3000             # page weight and load timing (site running)
```

Latest results and manual QA are recorded in [docs/TESTING.md](docs/TESTING.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md) · [Design direction](docs/DESIGN_DIRECTION.md) · [Asset manifest](docs/ASSET_MANIFEST.md)
- [Scheduler rules](docs/SCHEDULER.md) · [Gamification rules](docs/GAMIFICATION.md) · [Offline sync](docs/SYNC.md) · [API](docs/API.md)
- [Deployment guide](docs/DEPLOYMENT.md) · [Security & privacy checklist](docs/SECURITY_PRIVACY.md)
- [Testing, measurements & QA](docs/TESTING.md) · [Known limitations](docs/LIMITATIONS.md) · [Progress checklist](docs/PROGRESS.md)
- [Hackathon demo script](docs/DEMO_SCRIPT.md)

## Honesty notes

- Tobi and all demo/sample data are **fictional**. No real users, partnerships, endorsements or outcomes are claimed.
- Sample learning content was written by Team Apex and is **not educator-reviewed**.
- NextStep is independent and not endorsed by any university, scholarship programme or hackathon organiser.
