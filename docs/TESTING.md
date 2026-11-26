# Testing, measurements and QA

Results below were produced on the development machine (Windows 11, Node 24, Chrome stable, Android Emulator with an Android 16 / API 36 x86_64 image) on **9 November 2026**, and re-run for release 1.1.0 on **19 November 2026** (see [Release 1.1.0](#release-110-19-nov-2026)). Commands to reproduce are listed with each section.

## Summary

| Suite | Command | Result |
|---|---|---|
| Shared packages (unit) | `pnpm test:packages` | **95 passed** (7 packages) |
| API + offline sync (integration, real PostgreSQL) | `pnpm test:api` | **44 passed** (4 files; 26 Nov, with the waitlist endpoint) |
| Website e2e (desktop Chrome and Pixel 7 emulation; the browser demo and its tests were removed in 1.1.0) | `pnpm build:web && pnpm test:web` | **44 passed** (26 Nov) |
| Demo video (narration, captions, audio) | Whisper transcription of every line and of the final soundtrack; loudness and clipping check | **pass** — see [Demo video](#demo-video) |
| Type checks | `pnpm typecheck` / `tsc --noEmit` in mobile and API | **pass** |
| Secret scan of client code and built bundles | `pnpm check:secrets` | **pass** — 146 client files scanned (19 Nov) |
| Production website build | `pnpm build:web` | **pass** — 14 static routes (19 Nov) |
| API production packaging (the Dockerfile’s steps, run without Docker) | `pnpm --filter @nextstep/api deploy --prod`, then `prisma migrate deploy` on an **empty** database and `node dist/main.js` with `NODE_ENV=production` | **pass** — migrations applied, reference data loaded on boot, `/health`, `/v1/resources` and registration worked; JSON logs contained no email, password or token |
| Android release build | `gradlew assembleRelease` (local, debug-signed) | **pass** — 66.1 MB APK, installed and run on the emulator (see below); rebuilt on 9 Nov with the focus-timer and check-in fixes |
| Tester APK against the live API (11 Nov) | EAS `preview` build (EAS-managed key), installed on the emulator; sign-up through the UI | **pass** — 113 MB APK (all four CPU types); bundle points at the live API, no sample semester. Server asleep at the start: the "waking up" message showed after 5 s, sign-up finished in 26 s, onboarding completed, Profile showed *Synced*. Test account deleted afterwards (204, then login 401) |

| Android APK 1.1.0 (19 Nov) | EAS `preview` build 89e4722f, checked with `aapt2`/`apksigner` and on the emulator | **pass** — see [Release 1.1.0](#release-110-19-nov-2026) |

No test was skipped or marked as expected-to-fail. The Docker image itself was not built (Docker wasn’t running on this machine).

## Unit tests — shared packages (95)

| Package | Tests | What they cover |
|---|---|---|
| `contracts` | 14 | Lagos (UTC+1, no DST) conversions and late-night day boundaries; DST spring-forward gap and fall-back ambiguity (America/New_York); date-key arithmetic; stable UUIDs; schema validation; concurrent-change classification (important-field conflicts, same-value merges, last-writer-wins for other fields). |
| `design-tokens` | 10 | WCAG contrast for body, secondary, button, status and accent text in light and dark themes; visible borders and focus ring. |
| `illustrations` | 6 | Every mascot pose × skin × accessory, scene, badge (locked/unlocked) and the logo render as well-formed SVG with no scripts, event handlers or remote references; accessible titles are escaped; scenes contain no embedded text. |
| `scheduler` | 35 | No overlaps; inside availability and outside commitments; buffers; daily limits and session bounds; dependency ordering; protected rest; unschedulable deadlines with shortfall options (scope, defer, raise limit); partial completion; pinned sessions; no duplication on replan; determinism; online-only windows; non-splittable blocks; subtask labels; overdue tasks never moved; dependency cycles; day overrides; DST and timezone changes; midnight boundary; manual-plan analysis; Today shows ≤ 3 realistic actions without padding; session labels follow the open steps after missed sessions (and skip steps already ticked). Recovery: less time, missed session (with partial progress), urgent days, student-confirmed deadline change, lighter day, pinned sessions kept, stale previews (revision, inputs, time), honest shortfall after disruption, determinism. |
| `gamification` | 15 | Awards once regardless of toggling/sync; quick tasks; daily caps; long-focus limits and break rewards; recovery anti-farming; caps by local date (late sync not punished); ledger reconciliation; level curve; steady weeks don’t reset on a missed day; Back on Track only after the next action, once; cosmetic-only rewards; quests (≤ 3, one on light days, deterministic). |
| `engine` | 7 | Task + subtasks; plan revision first in the mutation list and first-plan XP once; deleting a task tombstones steps/sessions and unlinks dependants; finishing remaining work completes the task and clears its future sessions; daily cap reported as `capped`; undoing a recovery restores sessions under new IDs, removes the created override and keeps XP; only an accepted, not-undone recovery clears earlier missed-session prompts. |
| `demo-data` | 8 | The Tobi scenario contents; full recovery story (45 min → accept → next step → Back on Track once); stale preview refused; undo (and refusal once later work exists); completion XP once after reopen; overloaded week shortfall; weekly summary; resource provenance. |

## Integration tests — API on real PostgreSQL (42)

`apps/api/test`, run against a throwaway embedded PostgreSQL 17 cluster (or `TEST_DATABASE_URL`), with migrations and seed applied first.

- **System**: health; OpenAPI generated from contracts; structured 404s.
- **Auth**: registration validation; preferences id = user id; no account enumeration on login or reset; missing/malformed/forged tokens rejected; refresh rotation with family revocation on reuse; logout ends the session.
- **Isolation**: a user cannot read, edit or delete another user’s task; sync can’t overwrite or reference another user’s records; field-level validation errors; pagination by revision.
- **Offline sync**: retried pushes never duplicate; incremental pulls with server cursors; offline create-then-delete leaves a tombstone a stale device can’t resurrect; a delete for an unseen record blocks recreation; concurrent deadline edits preserved as a conflict while other fields auto-merge; duplicate plan from another device on the same base revision rejected; atomic batches roll back entirely.
- **XP**: server verifies awards, ignores claimed XP, never double-awards; unearned achievements rejected.
- **Planning/Recovery without AI**: plan generation and Today; stale recovery preview refused, fresh one accepted; AI routes degrade gracefully without credentials.
- **Resources**: original resources with sizes and honest review status. **Account**: export, deletion, tokens invalidated.
- **Security**: auth rate limiting; logs never contain passwords, tokens or emails; security headers.
- **Mobile sync (real mobile modules)**: `mobile-sync.test.ts` runs the app’s own `db`, `repo`, `sync` and `api` modules on Node’s SQLite against the real API: first sync then offline edits that persist through a simulated restart and sync once without duplicates; a push whose response is lost is retried safely; two phones with concurrent deadline edits keep both versions for the student and deletions stay deleted; duplicate plan generation on two phones doesn’t duplicate sessions; offline XP confirmed once across phones; accounts isolated on a shared phone and local data deleted on sign-out.
- **AI (stubbed provider, no network)**: student text can’t break out of its data block; every field of an AI draft is validated and clamped; refusals and provider errors fall back with `AI_UNAVAILABLE`; the daily limit is enforced before calling the provider.

## End-to-end tests — website (44 = 22 × 2 viewports, 26 Nov)

`apps/web/e2e/site.spec.ts` against the production build (`next start`), on desktop Chrome and Pixel 7 emulation:

- All 9 pages return 200, have exactly one `h1`, no console errors or uncaught page errors, and no horizontal scrolling.
- Home hero: *Get Started* links to the download section and *Watch the demo* to the video, with no fact pills or download button; the FAQ teaser links to all questions with *See all*.
- Waitlist (with the API mocked, so nothing is stored): the form sends only `{ email }`, confirms with “You’re on the list”, and explains a server error.
- Calls to action: *Watch the demo* opens `/demo` with the video; the header's *Get the app* lands on the download section. Every internal link on the home and demo pages resolves; sitemap and robots exist (the sitemap no longer lists `/demo/interactive`).
- The interactive demo is gone: `/demo/interactive` returns 404 and no page links to or mentions it.
- Download: on the demo page the *Download Android APK* button links to `release.json`'s file with a `download` attribute, shows the version, the install steps are next to the video, and the APK is served with `application/vnd.android.package-archive` and the exact byte size. (Skipped while no APK is published.)
- Reset-password page shows the code from the URL fragment, handles a missing code and is `noindex`.
- Features page shows at least 20 real app screenshots; every one loads and has alt text.
- Home hero slideshow: the pause button works and a screen can be chosen by hand.
- Scroll reveals: motion is on and a section heading is revealed when scrolled into view.
- With reduced motion: motion stays off, nothing is hidden, and the slideshow starts paused.
- `/demo` video: the MP4 is served as `video/mp4`, preloads metadata only, has a poster and an English captions track on by default (valid WebVTT), discloses the synthetic voice and shows the transcript. In Chrome the video loads (over 60 s long) and a chapter button seeks to Recovery Mode; these playback checks are skipped, with a note, in browsers without an H.264 decoder.

A layout review script also screenshotted every page at 1440 px and 390 px and flagged tap targets under 44 px, off-screen elements and over-long lines; the issues it found (footer links, theme toggle and slideshow buttons at 40 px, uneven footer columns, phone hero buttons of different widths, a 140-character line) were fixed.

## Manual QA on the Android emulator

Device: Android Emulator, Pixel-class profile 1080×2400 @ 420 dpi, Android 16 (API 36, x86_64), running the app in **Expo Go (SDK 58)** against the local API.

| Check | Result |
|---|---|
| Welcome → sample semester (fictional Tobi) → Today | ✅ Level/XP card, next session with reasons, deadlines, “My plans changed” |
| Recovery: *I have less time* → 45 min → preview | ✅ Before/after with per-change reasons and a smaller next step |
| Accept the proposal | ✅ Plan updated |
| Focus timer survives the app being force-stopped | ✅ Started a 45-min session, force-stopped the app for 5 min, reopened: 39:54 remaining and the 5 minutes were counted |
| Check-in after focus auto-ticks the matching subtask | ✅ |
| **Back on Track** achievement after completing the recovery’s next action | ✅ Unlocked once with celebration |
| Data persists across app restarts | ✅ XP 49 → 64 → 92 carried across restarts |
| Tab bar respects the gesture-navigation inset | ✅ (fixed during QA) |
| Screens captured for the website | ✅ 24 screens in `apps/web/public/screens/app/` (light and dark), captured from the release APK on 9 Nov — see [ASSET_MANIFEST.md](ASSET_MANIFEST.md) |
| **Focus countdown updates live (release build)** | ✅ after a fix (below): 44:00 → 43:55 over five seconds on the rebuilt APK |
| Check-in “work left” follows the chosen focus time | ✅ after a fix: choosing 30 min changed the suggestion from 134 to 105 minutes |
| **Account sync, offline edit and restart** (9 Nov) | ✅ Signed in to a fresh account → first sync downloaded its course and task (“Synced”). Airplane mode on → added a step to the task → badge “Offline · 1 waiting”. Restarted the app with the API unreachable (Expo Go itself can’t start in airplane mode, so the server was stopped instead) → the step was still there and still “1 waiting”. Started the API → app synced automatically → “Synced”. Server check: exactly **one** copy of the step, on the right task, from a single push. |
| Leaving guest/sample mode asks for confirmation | ✅ “Leave the sample semester?” dialog (added during QA — previously one tap deleted local data) |

Found and fixed while capturing the website screens (9 Nov, release APK): the **focus countdown stayed frozen** at its starting value while running (pausing showed the right remaining time, so the timestamps were correct). Cause: the React Compiler cached the screen’s output because the once-a-second re-render didn’t read any changed value; the clock now lives in component state (Focus and Today). Also: on the check-in, the “work left” suggestion didn’t follow the focus minutes you picked; it now does until you type your own number.

Found and fixed during this round: the sync badge flickered to “Syncing…” on every background retry while the server was unreachable (now stays “Offline · N waiting”); after missed sessions, Today showed a later step (“Write the one-page report”) instead of the next open one — labels are now computed from the open steps (also used to pre-tick the check-in).

Found and fixed during QA: an infinite mascot animation kept the UI thread busy (now a short two-hop animation); tab bar overlapped by the gesture bar; a sync bug where a record deleted on the server kept showing locally (tombstone JSON now updated); 15.9 MB development bundle from importing the whole icon set (now per-icon imports: 2,289 modules instead of 4,270).

## Measurements

### Sync data transferred

`apps/api/scripts/measure-sync.ts` against the local API (gzip enabled on responses). See [SYNC.md](SYNC.md#measured-payload-sizes):

| Workflow | Upload | Download |
|---|---|---|
| Full sample-semester upload (53 ops) | 28.6 KB | — |
| Fresh phone full download | — | 4.6 KB gzip (25.1 KB uncompressed) |
| Edit one task | ~0.9 KB | ~0.8 KB |
| Incremental pull after one edit | — | ~0.6 KB |
| Accept a recovery plan (33 ops) | 21.7 KB | 1.1 KB |

Payload bytes over localhost; TLS/HTTP overhead on a real network is extra.

### Website

`node apps/web/scripts/measure-web.mjs` against the production build (`next start`, localhost), Chrome with an emulated 390×844 phone, **4× CPU slowdown, 1.6 Mbps down / 750 kbps up / 150 ms RTT**, cold cache, median of 5 loads (`RUNS=5`), after the full-width redesign with real app screens and animations:

| Page | Transferred | of which JS | Requests | DOM ready | LCP |
|---|---|---|---|---|---|
| / | 338 KB | 149 KB | 16 | 6.6 s | 4.7 s |
| /how-it-works | 244 KB | 148 KB | 14 | 0.7 s | 2.6 s |
| /features | 326 KB | 148 KB | 15 | 3.2 s | 2.9 s |
| /community | 233 KB | 142 KB | 13 | 0.7 s | 2.5 s |
| /about | 249 KB | 142 KB | 16 | 0.7 s | 2.2 s |
| /faq | 257 KB | 149 KB | 17 | 0.7 s | 2.1 s |
| /privacy | 255 KB | 149 KB | 17 | 0.7 s | 2.1 s |
| /demo | 317 KB | 227 KB | 15 | 0.6 s | 1.7 s |

Every page is a static prerender. These numbers were taken while an Android emulator and a development server were also running on the machine, so the timings are noisier than the byte counts. Two earlier 3-run passes measured the home page at 3.4 s and 4.3 s LCP, with 1.3 s and 3.4 s DOM ready. The first of those ran before the slideshow loaded its screens lazily, when the page was 451 KB. Before the redesign the home page was 254 KB with 4.4 s DOM ready and 3.9 s LCP.

The home and features pages are the heaviest. They carry real app screenshots (WebP, 720×1600 sources resized by Next.js; the hero slideshow loads only the current and next screen), and the home page's inline SVG illustrations cost parse time on a throttled CPU. Lab numbers from one machine (localhost, so no real network variance or CDN), not field data.

### Mobile app size and behaviour

Release APK built locally (`assembleRelease`, debug-signed, from a short-path copy — see [DEPLOYMENT.md](DEPLOYMENT.md#4-android-app)) and installed on the emulator:

| Measure | Result |
|---|---|
| APK size (arm64-v8a **and** x86_64 in one file) | **66.1 MB** — native libraries 25.3 MB (arm64) + 26.9 MB (x86_64), Hermes JS bundle 4.4 MB, DEX 3.2 MB, resources 2.5 MB |
| arm64-only contents (what a phone would get from a per-ABI split/AAB) | ≈ 36–39 MB installed; ≈ 15 MB if fully deflate-compressed (rough download estimate, not a Play Store measurement) |
| Permissions | INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, VIBRATE, WAKE_LOCK, install-referrer and launcher-badge entries. Microphone, storage, overlay, biometric and push-receiver permissions are blocked. |
| Cold start (`am start -W`, emulator x86_64, idle host) | 2.9 s first launch after clearing data; 1.4–1.9 s afterwards (1,357 / 1,500 / 1,879 ms); 1.7 s relaunch in airplane mode |
| Memory on Today (sample semester) | ≈ 97 MB PSS |
| Sample semester on the release build | ✅ Today renders, correct next step, missed-session card |
| **Offline launch and edit** | ✅ Airplane mode on → marked the missed sessions → force-stopped → relaunched offline: the change and XP were still there |
| Signing in on the release build against the local HTTP API | ❌ by design — release builds block plain HTTP; a release build needs an `https://` API URL (documented in DEPLOYMENT.md). Account sync was therefore verified in Expo Go (above) and by the automated `mobile-sync` tests. |

A first local release APK crashed on Today with `TypeError: undefined is not a function`. Cause: an interrupted build had bundled new app code against old shared-package output, and the next Gradle run reused that bundle because the bundle task doesn’t track `packages/*`. Rebuilding with the bundle output removed fixed it; the pitfall is documented in DEPLOYMENT.md. The figures above are from the corrected build.

## Demo video

The `/demo` walkthrough (`video/`, rendered with Remotion; 93.7 s, 1920×1080, 12.7 MB web MP4) was checked on 10 Nov 2026:

| Check | Result |
|---|---|
| Narration says what the script says | ✅ Each of the 11 synthetic-voice lines and the final soundtrack were transcribed with Whisper (`base.en`). Every sentence came back intact; the only differences were spellings (“next step” for NextStep, “45” for forty-five). “Tobi” was first heard as “toe by”, so the voice now gets the pronunciation hint “Toby” while captions keep “Tobi”. |
| Captions line up with the voice | ✅ Each spoken line starts within 0.65 s of its caption, which is about as precise as Whisper's word timings. |
| Audio level | ✅ Normalised for speech (≈ −18 dBFS RMS), peak 0.97 of full scale, no clipped samples. |
| Footage is real and current | ✅ Recorded from the release APK (with the focus-timer fix) on the emulator, then trimmed. Frames at every cut were inspected, and three cuts were moved after the first render because the app took longer to show Today, Journey and Plan than the tap timestamps suggested. |
| Every frame renders | ✅ 2,809 frames rendered without errors. The badge artwork failed to load as an image at first: `badgeSvg()` emitted duplicate `stroke-width` attributes, which is invalid XML (browsers tolerate it inline). This is fixed in `packages/illustrations`, and a unit test now rejects duplicate attributes in every generated SVG; the old code fails that test. |

While recording, switching tabs in the release build took 3–4 s on the emulator (with screen recording and UI automation running at the same time). This wasn't investigated further; earlier measurements without the recorder are in the APK section above.

## Release 1.1.0 (19 Nov 2026)

**The APK** (`apps/web/public/downloads/NextStep-1.1.0.apk`, EAS build `89e4722f`):

| Check | Result |
|---|---|
| Package, version | `com.teamapex.nextstep`, versionName 1.1.0, versionCode 2, minSdk 24 (Android 7.0), targetSdk 36 |
| Size and CPU types | 56.4 MB; `arm64-v8a` and `armeabi-v7a` only (phones), 29 native libraries each |
| Signature | APK Signature Scheme v2 verifies; certificate SHA-256 `97b64abe…0b12a` — the same EAS key as 1.0.0, so it installs as an update |
| Native code | All 58 native libraries are byte-identical to 1.0.0 (SHA-256 compared). Only the JavaScript bundle changed |
| Backend configuration | The bundle contains `https://nextstep-1nuf.onrender.com` and `https://nextstep-two-sandy.vercel.app`, no `10.0.2.2`/`localhost` |
| Secrets | None found in the bundle (searched for JWT/database/SMTP/AI key names, `postgresql://`, `sk-ant-`, private keys, `neon.tech`) |
| File on the website | SHA-256 `65f2c943…13b9f`, served as `application/vnd.android.package-archive`, size checked by the e2e test |

**On the emulator.** The x86_64 emulator image can't start this ARM-only APK: it translates ARM code, and its translator could not load the uncompressed native libraries from inside the APK (`couldn't find DSO to load: libreactnative.so`). Real ARM phones load them directly. Because the native code is identical to 1.0.0, the 1.1.0 **JavaScript bundle** was tested inside a copy of the 1.0.0 APK (which includes x86_64 libraries), re-signed with the local debug key for the emulator only — that copy was never published.

| Flow | Result |
|---|---|
| Update over 1.0.0 | A guest account made in 1.0.0 opened in 1.1.0 with its name, level and XP intact (the real 1.1.0 APK also installed over 1.0.0 with `adb install -r`: same signer, higher versionCode) |
| Sign-up (live API) | Keyboard *Next* moved name → email → password; the form stayed above the keyboard; show/hide password worked; account created in 8 s |
| Onboarding | Timezone dropdown: search “acc” → Accra, then back to Lagos. School suggestions filtered while typing (“Lag” → 3 schools). Course suggestion + code saved with *Save course and continue* (code upper-cased). Task: type, course, suggested title with the course code, date/time rows opened on the selected values, effort +15 min → 2 h 15 min, saved. Study time: From 22:00 moved To from 21:30 to 23:00 automatically. Commitment saved; plan built |
| Today / Plan | *Synced* badge; next session shown. Tapping a session opened the action sheet with all four actions; *Pin this time* pinned it |
| Recovery Mode | Less time → 45 min → proposal → *Accept changes* → “You still have a next step” |
| Focus and check-in | Timer counted down; check-in pre-filled work left (2 h 14 min), *1 h* chip, hint “Was 2 h 15 min…”; saved; Back on Track unlocked |
| Journey, Preferences | Level and XP shown; name edited in Preferences → Profile updated |
| Task editor | Title suggestions; effort picker; a step typed but not added was kept on save |
| Account deletion | In-app deletion with the password field → back to Welcome; login afterwards **401** |
| Crashes | None in the crash log during the session |

## Not tested

- iOS (no build).
- Real Android hardware, low-end devices and real mobile networks.
- Live AI provider calls, SMTP email delivery, any hosted deployment.
- TalkBack / VoiceOver screen-reader walkthroughs (labels and roles are set but not walked through).
- Notification delivery timing on a device.
- Load/performance testing of the API beyond the integration suite.
- Long-running multi-week usage.
