# NextStep mobile app

The NextStep app for Android (first) and iOS, built with Expo (SDK 58), Expo Router, SQLite and an offline sync outbox. It is part of the NextStep monorepo — see the [root README](../../README.md) for the whole project.

## Run it locally

From the repository root:

```bash
pnpm install
pnpm build:packages                           # shared scheduler, engine, contracts…
cp apps/mobile/.env.example apps/mobile/.env  # EXPO_PUBLIC_API_URL (Android emulator: http://10.0.2.2:4000)
pnpm dev:mobile                               # press "a" for Android, or scan the QR code in Expo Go
```

The **sample semester** and **guest mode** work without the API. Signing in and syncing need the API running (`pnpm dev:api`).

Only public `EXPO_PUBLIC_*` values belong in `.env`; they are bundled into the app. Never put secrets there.

## Builds

Release and store builds, the HTTPS-only rule for release builds, and the Windows path-length workaround are in [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md#4-android-app).

## More

- [Architecture](../../docs/ARCHITECTURE.md) · [Sync](../../docs/SYNC.md) · [Testing](../../docs/TESTING.md) · [Limitations](../../docs/LIMITATIONS.md)
