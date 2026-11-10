# Known limitations

Honest list of what NextStep does not do yet, what wasn’t verified, and trade-offs to be aware of.

## Not verified in this environment

- **iOS**: never built or run. Code uses cross-platform Expo modules, but safe areas, notification permission prompts, SecureStore and fonts need device QA.
- **Docker image**: the image itself was not built (Docker wasn’t running on the development machine). Its steps were reproduced on Windows instead — `pnpm deploy --prod`, `prisma migrate deploy` on an empty database, `node dist/main.js` in production mode — and the result served health, resources and registration (see [TESTING.md](TESTING.md)). The Linux base image and its native `argon2`/Prisma binaries are untested.
- **Live AI**: no request was made to the AI provider. Prompting, validation and fallback were tested with a stubbed provider.
- **Email**: password-reset email delivery needs SMTP; only the no-SMTP path and the token flow were tested.
- **Vercel/hosting**: deployment settings are documented but not tried on a real host.
- **Real phones and networks**: testing used an Android emulator on a desktop; no low-end device, real mobile network, or field test with students.
- **Screen readers**: labels and roles are set, but no full TalkBack/VoiceOver walkthrough was done.
- **Notifications**: reminder scheduling is implemented and re-run after every plan change, but delivery timing on a real device wasn’t observed end to end.

## Product gaps

- **Guest → account**: guest-mode data stays on that phone; it can’t be moved into a new account yet.
- **Educator sharing**: not built.
- **Email verification** for new accounts: not built.
- **Server push**: none; reminders are local, so they only reflect the plan on that phone until it syncs.
- **Calendar import/export** (Google Calendar, ICS): not built.
- **Languages**: English only.
- **Learning content**: four short sample resources written by the team, not reviewed by an educator, with a licence still to be chosen. NextStep is not a course-content platform.
- **Recurring tasks** (e.g. weekly readings) must be added individually.
- **Web app for students**: the website demo is a demo with fictional data; signed-in use is mobile only.

## Technical trade-offs

- **Local database not encrypted** at rest beyond the OS sandbox/device encryption. Tokens are in secure storage.
- **Rate limits are per API instance** (in memory). Use shared storage before running several instances.
- **No CSP** on the website yet.
- **Planning horizon is 14 days**; work due further out is planned as the window moves.
- **Scheduler is greedy** (earliest effective deadline first with what-if options), not an optimiser. It never claims a plan fits when it doesn’t, but in rare cases a different arrangement could fit slightly more work; Recovery Mode compares a local and a global replan and picks the one that fits more.
- **Conflict UI** covers important-field conflicts and duplicate plans; other concurrent edits merge automatically (last write wins per field).
- **Sync payloads**: responses are gzip-compressed; request bodies (uploads) are not. Measured sizes are from localhost, not mobile networks.
- **Expo Go vs release build**: most manual QA ran in Expo Go (development mode). The release APK was smoke-tested on the emulator (sample semester, offline restart, cold start, memory), but signing in on it needs an HTTPS API, which wasn’t available locally.
- **Demo video is a snapshot**: it shows the app as recorded on 10 Nov 2026 on an emulator. Re-record it after visible UI changes (`video/README.md`). The narration is a synthetic US-English voice, disclosed on the page; there is no human voice-over or other language yet.
- **Time handling**: the app uses the phone’s clock; a badly wrong device clock can mis-order actions locally (the server rejects XP events dated in the future).

## Claims we do not make

- Not “production-ready”: it is implemented and tested locally by the team, not operated in production.
- Not “low-data” as a guarantee: we report measured payload sizes and design choices (local-first, gzip, small incremental syncs, vector art) instead.
- No proven learning outcomes, real users, partnerships, endorsements or awards.
