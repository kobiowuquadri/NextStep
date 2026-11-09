# Hackathon demo script (about 5 minutes)

Everything shown uses **fictional data**. Say so once at the start: *“Tobi is a fictional student we made up to show the product.”*

## Before you start

- Website running (`pnpm build:web && pnpm --filter @nextstep/web start`, or the deployed site) — open `/demo` and press **Reset demo**.
- Optional for the phone part: Android emulator or phone with the app (release APK or Expo Go), API running if you want to show sync.
- Close other tabs; turn on “Do not disturb”.

## 0:00 — The problem (30 s)

> “Students in Nigeria balance lectures, part-time work, long commutes, family duties and expensive data. Most planners assume a perfect week. When one evening falls apart, the plan breaks and students feel behind. NextStep is built for the moment plans change.”

Show the home page hero: *Plans change. Keep moving.*

## 0:30 — Meet Tobi (45 s) — `/demo`, Today

> “Tobi is in second year, works shifts at a print shop on Monday, Wednesday and Friday, takes the bus home, and has lectures on Tuesday and Thursday.”

- Point out **Today**: at most three next actions, each with *why* (“Due Fri 18:00 (in 3 days)”, “Unlocks ‘Upload assignment’”).
- Tap **Plan** → the week: a Linked list assignment due Friday, a Linear Algebra class test, an essay outline, a reading goal. Sessions sit in evenings around work and commute. Wednesday evening is marked *data usually low*, so the online upload task isn’t placed there.

## 1:15 — Plans change (90 s) — Recovery Mode

> “Tonight Tobi’s shift ran late. He only has 45 minutes.”

1. Tap **My plans changed** → **I have less time** → 45 min → **Show me the new plan**.
2. Open **Show before / after**: which sessions moved, shortened or split, each with a reason (“Today now has 45 min, so this moves to Thu 19:00”), and the **smallest next step**.
3. Point out: *nothing has changed yet* — **Accept changes**, **Adjust proposal** or **Keep my current plan**.
4. **Accept changes**. “One tap, applied atomically, and it can be undone.”

Optional (20 s): Plan → tap a past session → **I missed this — find a new time** to show the missed-session path.

## 2:45 — Back on track (45 s)

1. Tap **Start: …** on the proposal (or **Start session** on Today), then finish and do the quick check-in.
2. The **Back on Track** achievement unlocks (once — try again and it won’t double-award).
3. **Journey**: XP, level, steady weeks (not daily streaks), quests, the badge, and the mascot cosmetic it unlocked. “Rewards are for progress, recovery, reflection and breaks — never for time in the app. Nothing is ever taken away.”

## 3:30 — Honest when it doesn’t fit (40 s)

Press **Load overloaded week**.

> “Here a group report needs 10 hours by Wednesday. NextStep doesn’t pretend.”

Show the shortfall message and the options: reduce scope, defer a lower-priority task (with minutes gained), raise the daily limit for a few days, add time, or ask the lecturer — “NextStep never changes a real deadline for you.”

## 4:10 — Offline and the phone (40 s)

On Android (sample semester or a signed-in account):

- Turn on airplane mode → edit a task, accept a recovery → the header shows *changes waiting*.
- Force-close and reopen the app: everything is still there; the focus timer kept running.
- Turn the network back on → *Synced*. “Every change has an ID, so retries never duplicate, and if two phones disagree on a deadline the student chooses — nothing is silently overwritten.”

If no phone is available, show the **On Android** screenshots on `/features` (captured from the real app).

## 4:50 — Close (10 s)

> “NextStep: realistic plans, explained, and a next step whenever life gets in the way. Plans change. Keep moving.”

## If something goes wrong

- Demo in a strange state → **Reset demo** (top of `/demo`).
- No internet at the venue → the website demo and the phone app’s sample semester work fully offline once loaded.
- AI features are optional and off without a server key — don’t demo them unless a key is configured.

## Claims to avoid

Don’t claim real users, pilots, partnerships, school endorsements, learning outcomes, awards or app-store availability. Say “built and tested by the team”, not “production-ready”. When mentioning data use, quote the measured numbers in [SYNC.md](SYNC.md) and say they were measured locally.
