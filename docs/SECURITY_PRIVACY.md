# Security and privacy checklist

Status key: **Tested** = covered by an automated test · **Implemented** = in code, checked manually or by review only · **Open** = not done.

## Authentication and sessions

| Control | Status | Where |
|---|---|---|
| Passwords hashed with Argon2id (19 MiB, t=2, p=1) | Implemented | `apps/api/src/auth/auth.service.ts` |
| Minimum password length 10, max 128 | Tested | contracts `Password`, `api.test.ts` |
| Login doesn’t reveal whether an email exists (same error, dummy hash for unknown emails to equalise timing) | Tested | `api.test.ts` |
| Access tokens: HS256 JWT, 15 min, issuer + audience checked, algorithm pinned | Tested (forged/malformed tokens rejected) | `tokens.service.ts` |
| Refresh tokens: 256-bit random, stored only as SHA-256 hash, rotated on every use, **reuse revokes the whole family** | Tested | `api.test.ts` |
| Logout revokes the refresh token immediately | Tested | `api.test.ts` |
| Password reset: single-use, 30 min, hashed token, no account enumeration, all sessions revoked on reset | Tested (enumeration); implemented (email delivery needs SMTP) | `auth.service.ts` |
| Reset token travels in the URL **fragment** (`#token=`), which browsers don’t send to servers or in Referer headers; the reset page is `noindex` | Implemented | `apps/web/src/app/reset-password` |
| Rate limiting: 120 req/min general, 20/min auth, 5/min reset requests and account export/delete | Tested (auth) | `throttle.ts`, `security.test.ts` |
| Mobile tokens in platform secure storage (Android Keystore / iOS Keychain via `expo-secure-store`), never in SQLite or AsyncStorage | Implemented | `apps/mobile/src/lib/api.ts` |

## Authorisation and data isolation

| Control | Status |
|---|---|
| Every route requires a valid access token unless explicitly `@Public()` (health, auth, resources) | Implemented (global guard) |
| Every query is scoped by `userId`; IDs from another account can’t be read, edited, deleted or referenced as parents, including through sync | Tested (`api.test.ts` ownership tests) |
| Separate local database per account on the phone; sign-out deletes it | Tested (`mobile-sync.test.ts`) |
| Sign-out with unsynced changes requires explicit confirmation | Implemented |
| Account deletion requires password + typing `DELETE`; cascades all data; tokens stop working | Tested |
| Data export (JSON) of everything stored | Tested |

## Input handling

| Control | Status |
|---|---|
| All bodies, queries and sync records validated with shared Zod schemas (types, lengths, enums, ranges) | Tested |
| Request bodies limited to 1 MB; sync pushes to 200 ops | Implemented |
| Database CHECK constraints for key invariants (e.g. non-negative minutes, valid importance) | Implemented (`migration.sql`) |
| No raw SQL with user input (Prisma parameterised queries; the one raw call is a parameterised advisory lock) | Implemented |
| Rendered user text is escaped by React / React Native (no `dangerouslySetInnerHTML` with user content; SVG markup comes only from our own illustration code) | Implemented |
| **Untrusted content never changes behaviour**: learning resources are rendered as plain text sections; student text sent to AI is wrapped as data, tag-escaped, and the model is told not to follow instructions in it; AI output is schema-validated and only ever pre-fills a form the student must confirm | Tested (`ai.test.ts`, with a stubbed provider) |
| The app never extends or invents a real deadline; deadline changes only come from the student | Tested (scheduler/recovery tests) |

## Transport, headers and browser

| Control | Status |
|---|---|
| HTTPS | **Deployment responsibility** — see [DEPLOYMENT.md](DEPLOYMENT.md) |
| API: Helmet security headers and no `X-Powered-By` | Tested (`security.test.ts`) |
| API: CORS allow-list from `CORS_ORIGINS` | Implemented |
| Website: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`; no `X-Powered-By` | Implemented (`next.config.ts`) |
| Content-Security-Policy on the website | **Open** — needs nonce support for Next.js inline scripts |
| Website uses no cookies, analytics or third-party trackers; the demo stores data only in the visitor’s `localStorage` | Implemented |

## Secrets

| Control | Status |
|---|---|
| Server secrets (`JWT_SECRET`, `DATABASE_URL`, SMTP, `ANTHROPIC_API_KEY`) only in server env; `.env` files git-ignored; `.env.example` files contain placeholders only | Implemented |
| Automated scan for server secret names/values in web source, built web bundles, mobile source, Android JS bundle and shared packages | Implemented — `pnpm check:secrets` (passed on last run) |
| Client config uses only public `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` values (URLs) | Implemented |
| No shared writable demo account in production: the seeded demo account is opt-in, needs its own password, and the public demo runs in the browser without the API | Implemented |

## Logging

| Control | Status |
|---|---|
| Access logs: method, route pattern, status, duration, request ID, and a one-way hash of the user ID — no bodies, query strings, headers, emails, tokens or task text | Tested (`security.test.ts` asserts no passwords, tokens or emails in logs) |
| Errors log type and route only; 5xx bodies never echoed to clients | Implemented |
| AI failures log feature name and error type only | Tested |
| In `NODE_ENV=development` **only**, the password-reset link is logged when SMTP isn’t configured, so the flow can be tested locally. Production never logs it. | Implemented |

## Mobile device data

| Item | Status |
|---|---|
| Tokens in secure storage | Implemented |
| Study data in an app-private SQLite file, **not encrypted at rest** beyond OS/device encryption | Known limitation |
| Android backup follows Expo defaults; review `allowBackup` before store release | Open decision |
| Unused permissions blocked (`RECORD_AUDIO`, storage, `SYSTEM_ALERT_WINDOW`) | Implemented (`app.json` `blockedPermissions`) |
| Notifications are local; content shows task titles — students can turn reminders off; quiet hours respected | Implemented |

## Privacy

What is collected (account mode): email, display name, password hash, timezone, and the study data the student enters (courses, tasks, availability, commitments, sessions, focus logs, reflections, goals, XP events). Nothing is collected in guest or sample-semester mode, or in the website demo.

- **Purpose limitation**: data is used only to provide planning, sync and progress features. No advertising, no selling, no third-party analytics.
- **AI**: off unless the operator configures a key. When used, only the text the student chooses to send is transmitted to the AI provider; it’s not stored by NextStep beyond a usage counter (feature, success flag, time).
- **Access and deletion**: export and delete are self-service in the app (Profile → Privacy).
- **Retention**: data is kept until the student deletes it or the account; revoked refresh tokens and expired reset tokens can be pruned by the operator (no automatic job yet — **Open**).
- **Children**: the product targets tertiary students; no age gate is implemented.
- **Policy pages**: `/privacy` and `/terms` on the website are marked *Draft* and must be reviewed by the operator before launch (operator identity, contact, jurisdiction-specific wording such as Nigeria’s NDPA).

## Not done / recommended before public launch

- Content-Security-Policy for the website.
- Encrypting the local database (e.g. SQLCipher) if task text is considered sensitive.
- Shared rate-limit storage if the API runs on more than one instance.
- Scheduled cleanup of expired tokens and old sync-operation records.
- Independent security review / penetration test.
- Email verification for new accounts (accounts work without it today).
