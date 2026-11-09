# Deployment guide

Nothing has been deployed or published by the development team: no hosting, domains, store listings or paid services were created. This guide is one coherent path for whoever deploys NextStep. Any equivalent provider works; names below are examples, not partnerships.

```
 Students' phones ──HTTPS──►  API container (Docker)  ──►  Managed PostgreSQL 15+
 Browsers ──HTTPS──► Website (Next.js, mostly static)        (backups, TLS)
                     └ /demo runs entirely in the browser — no API, no account
```

| Component | Recommended target | What it needs |
|---|---|---|
| Database | Managed PostgreSQL 15+ with automated backups (any provider) | UTF-8 database, TLS connection string |
| API | Any container host (e.g. Render, Railway, Fly.io, a VPS with Docker + Caddy) | The `apps/api/Dockerfile` image, env vars below, HTTPS |
| Website | Vercel (Next.js native) or any Node host | Build command below, `NEXT_PUBLIC_*` vars |
| Android app | EAS Build → Google Play (AAB) and/or a direct APK | Expo account, Play Console account, production API URL |
| iOS app | EAS Build → App Store Connect | Apple Developer account. **Not yet verified on iOS** |

## 1. Database

1. Create a PostgreSQL 15+ database with **UTF-8 encoding**, a dedicated user, TLS required and automated daily backups / point-in-time recovery enabled.
2. Use the connection string as `DATABASE_URL` (add `?sslmode=require` if the provider needs it).
3. Migrations run automatically when the API container starts (`prisma migrate deploy` applies only migrations not yet recorded). To run them yourself: `DATABASE_URL=… pnpm db:migrate`.
4. Reference data (achievement catalogue, sample learning resources) is upserted by the API on every start. **Do not** set `SEED_DEMO_ACCOUNT=true` on a public database: it creates a fictional account with a known password.

Manual backup / restore:

```bash
pg_dump --format=custom --no-owner "$DATABASE_URL" > nextstep-$(date +%F).dump
pg_restore --clean --no-owner --dbname "$DATABASE_URL" nextstep-YYYY-MM-DD.dump
```

Test a restore into a scratch database before relying on backups.

## 2. API

Build from the **repository root** (the API uses shared workspace packages):

```bash
docker build -f apps/api/Dockerfile -t nextstep-api .
docker run --env-file api.production.env -p 4000:4000 nextstep-api
```

Required environment (set as host secrets, never committed):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` (JSON logs, no development reset-link logging) |
| `PORT` | Provided by the host, default 4000 |
| `DATABASE_URL` | From step 1 |
| `JWT_SECRET` | ≥ 32 random characters: `openssl rand -base64 48`. Rotating it signs everyone out of their access tokens (refresh tokens still work). |
| `CORS_ORIGINS` | Your website origin(s), comma-separated, e.g. `https://nextstep.example.org`. Mobile apps send no Origin header and aren’t affected. |
| `APP_PUBLIC_URL` | Website origin. Password reset emails link to `APP_PUBLIC_URL/reset-password#token=…`; that page shows the code to paste in the app. |
| `TRUST_PROXY` | `true` when behind the host’s load balancer/reverse proxy (needed for correct per-IP rate limits). |

Optional:

| Variable | Purpose |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | Password reset email. Without SMTP, reset requests return the same response but no email is sent — set this up before launch. |
| `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`, `AI_DAILY_LIMIT_PER_USER` | Optional AI suggestions. Without a key the feature is simply unavailable; planning and Recovery Mode don’t need it. Costs are billed to the key owner. |
| `RATE_LIMIT_PER_MINUTE`, `AUTH_RATE_LIMIT_PER_MINUTE` | Defaults 120 and 20. |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS` | Defaults 900 and 30. |

Checks after deploying:

```bash
curl https://api.example.org/health          # {"status":"ok","db":"ok",...}
open https://api.example.org/docs            # API reference
```

- Serve **HTTPS only** (the host’s TLS or Caddy/nginx in front). The API sets security headers with Helmet.
- Point the host’s health check at `/health`.
- Logs are JSON lines with request IDs, routes, status and timings — no bodies, passwords, tokens or task text. Forward them to your log tool.
- **Scaling**: one instance handles the expected hackathon/pilot load. Running several instances works for data (all state is in PostgreSQL; sync uses per-user advisory locks) but rate limits are per instance (in memory). Use a shared store (e.g. Redis with a throttler storage adapter) before scaling out.

## 3. Website

Vercel project settings:

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root directory | `apps/web` (Vercel detects the pnpm workspace and installs from the repository root) |
| Build command | `cd ../.. && pnpm build:web` (shared packages must be compiled first) |
| Output directory | default (`.next`) |
| Node.js | 22 or newer |

These settings follow Vercel’s documented monorepo setup but have not been tried on a Vercel account by the team. On any Node host instead: `pnpm install --frozen-lockfile && pnpm build:web && pnpm --filter @nextstep/web start` (this exact sequence is what was tested locally).

Environment (all public — **never put secrets in `NEXT_PUBLIC_*`**):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, sitemap and social cards. |
| `NEXT_PUBLIC_ANDROID_URL` | Google Play listing, once it exists. |
| `NEXT_PUBLIC_APK_URL` | Direct APK download (e.g. a GitHub release asset), if you publish one. |
| `NEXT_PUBLIC_IOS_URL` | App Store listing, once it exists. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | A real team contact address. Omitted from the site when empty. |

While the download variables are empty the site states honestly that the app isn’t available to download yet and points to the browser demo. Rebuild after changing them (they are inlined at build time).

The browser demo needs no configuration: it uses fictional data and stores changes only in the visitor’s browser.

Before launch, review `apps/web/src/app/privacy` and `terms` with whoever operates the service — they describe the implemented data handling but are not legal advice — and fill in the operator’s identity and contact.

## 4. Android app

1. Set the production URLs in `apps/mobile/eas.json` (`preview` and `production` profiles): `EXPO_PUBLIC_API_URL=https://api.example.org`, `EXPO_PUBLIC_SITE_URL=https://nextstep.example.org`. These are public values; no secrets belong in the app.
2. `cd apps/mobile && npx eas-cli login && npx eas-cli init` (links the project to your Expo account; adds the project ID to `app.json`).
3. Test build (installable APK): `npx eas-cli build --platform android --profile preview`.
4. Store build (AAB): `npx eas-cli build --platform android --profile production`. EAS creates and stores the upload keystore — keep a backup.
5. Upload to Google Play Console (internal testing track first). The Play listing needs: privacy policy URL (`/privacy` on the website), data-safety answers (account email, display name, study data; encrypted in transit; deletion available in-app), screenshots captured from the real app, content rating.
6. Put the Play listing URL in `NEXT_PUBLIC_ANDROID_URL` and redeploy the website.

**Local release builds on Windows**: React Native’s native (CMake/ninja) builds exceed Windows’ 260-character path limit when the repository is deep (e.g. under `Desktop\…`). EAS Build (Linux) avoids this entirely. What worked locally:

1. Copy the repository (without `node_modules`) to a short path such as `C:\nsb` — a real copy; `subst` drives and junctions are resolved back to the long path and break codegen — then `pnpm install --frozen-lockfile && pnpm build:packages`.
2. `cd apps/mobile && npx expo prebuild --platform android --clean`.
3. In the generated `android/app/build.gradle`, inside `android { … }`, add `externalNativeBuild { cmake { buildStagingDirectory = file('C:/nsx') } }` so the app’s own codegen objects also fit (the generated folder is regenerated by prebuild and not committed).
4. `cd android && gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` (add `,x86_64` for emulators).

A local `assembleRelease` is signed with the debug key and is **for testing only**; store builds come from the EAS steps at the top of this section.

Two pitfalls found while building locally:

- **Stale JS bundle**: Gradle’s `createBundleReleaseJsAndAssets` task only tracks files inside `apps/mobile`, not the shared `packages/*`. After changing a shared package, rebuild the packages *and* delete `android/app/build/generated/assets/react` (or run with `--rerun-tasks`) — otherwise Gradle can reuse an old bundle that no longer matches the app code and the app crashes at runtime. EAS builds start clean and aren’t affected.
- **HTTPS only in release builds**: Android release builds block plain-HTTP traffic (only debug builds allow it), so `EXPO_PUBLIC_API_URL` must be an `https://` URL for any release/preview build. A release APK pointed at `http://10.0.2.2:4000` cannot sign in.

Notifications are local (scheduled on the device) — no push credentials (FCM/APNs) are required.

## 5. iOS app

`npx eas-cli build --platform ios --profile production`, then `npx eas-cli submit --platform ios`. Requires an Apple Developer membership. The iOS build has not been compiled or tested by the team; budget time for device QA (safe areas, notifications permission flow, SecureStore, fonts).

## 6. Pre-launch checklist

- [ ] `pnpm test` and `pnpm --filter @nextstep/web build && pnpm test:web` pass on the release commit.
- [ ] `pnpm check:secrets` passes after building the website and the Android bundle.
- [ ] `JWT_SECRET` is unique and long; database user is not a superuser; TLS everywhere.
- [ ] `CORS_ORIGINS` and `APP_PUBLIC_URL` point at the real website; `TRUST_PROXY=true` behind a proxy.
- [ ] SMTP configured and a password reset tested end to end.
- [ ] `SEED_DEMO_ACCOUNT` is not `true` in production.
- [ ] Backups enabled and a restore tested.
- [ ] Privacy policy and terms reviewed; operator contact filled in; Play data-safety form matches [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md).
- [ ] Download links set only once the store listings or APK actually exist.
- [ ] Health check and log forwarding configured; someone is on call for the launch.
- [ ] If AI is enabled: billing alerts on the provider account and the daily per-user limit reviewed.
