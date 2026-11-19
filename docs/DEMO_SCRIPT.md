# Hackathon demo script (about 5 minutes)

Everything shown uses **fictional data**. Say so once at the start: *“Quadri is a fictional student we made up to show the product.”*

## Before you start

- **Phone or emulator** with the NextStep APK from the website (`/demo#download`).
- **Quadri’s sample semester** in a temporary account (it’s relative to today, so do this on the day):

  ```bash
  cd apps/api
  API_URL=https://nextstep-1nuf.onrender.com npx tsx scripts/sample-account.ts create ../../demo-account.json
  ```

  Sign in on the phone with the email and password in `demo-account.json` (keep that file out of git). Open the app once a few minutes before you present: the free API server sleeps after 15 minutes and takes about a minute to wake.
- **Backup**: the narrated walkthrough video at `/demo`. Play it if the phone or the network lets you down.
- Close other apps; turn on “Do not disturb”.
- **Afterwards**: `npx tsx scripts/sample-account.ts delete ../../demo-account.json` removes the account and its data.

## 0:00 — The problem (30 s)

> “Students in Nigeria balance lectures, part-time work, long commutes, family duties and expensive data. Most planners assume a perfect week. When one evening falls apart, the plan breaks and students feel behind. NextStep is built for the moment plans change.”

Show the website hero: *Plans change. Keep moving.*

## 0:30 — Meet Quadri (45 s) — app, Today

> “Quadri is in second year, works shifts at a print shop on Monday, Wednesday and Friday, takes the bus home, and has lectures on Tuesday and Thursday.”

- **Today**: the next session with *why* it matters (“Due Fri 18:00 (in 3 days)”), and a card saying sessions didn’t happen yesterday — “That’s okay, you still have a next step.”
- **Plan** → the week: a linked-list assignment due Friday, a Linear Algebra class test, an essay outline, a reading goal. Sessions sit in the evenings around work and commute. Tap a session to show its options (log it, I missed this, pin this time).

## 1:15 — Plans change (90 s) — Recovery Mode

> “Tonight Quadri’s shift ran late. He only has 45 minutes.”

1. Tap **My plans changed** → **I have less time** → 45 min → **Show me the new plan**.
2. Walk through **What changes**: which sessions move, shrink or split, each with a reason (“Today now has 45 min, so this moves to Thu 19:00”), and **Your next step**.
3. Point out: *nothing has changed yet* — **Accept changes**, **Adjust proposal** or **Keep my current plan**.
4. **Accept changes**. “One tap, applied together, and it can be undone from Plan.”

## 2:45 — Back on track (45 s)

1. Tap **Start: …**, then **Finish and check in** (or use **Log it** on Today to skip the timer). The check-in asks how much is left with one tap — no typing.
2. **Back on Track** unlocks (once — doing it again won’t double-award).
3. **Journey**: XP, level, steady weeks (not daily streaks), quests and badges. “Rewards are for progress, recovery, reflection and breaks — never for time in the app.”

## 3:30 — Honest when it doesn’t fit (40 s)

Plan → Tasks → **Add task**: “Group report”, due in two days, **5 h** of work, importance **Critical** → **Add task**.

> “NextStep doesn’t pretend everything fits.”

Show the **Not everything fits** card on Plan: how many minutes are short before which deadline, and the options (reduce scope, defer a lower-priority task, raise the daily limit for a few days, add time, ask the lecturer). “NextStep never changes a real deadline for you.”

## 4:10 — Offline (40 s)

- Turn on airplane mode → edit a task or accept a recovery → the header shows *changes waiting*.
- Force-close and reopen: everything is still there; a running focus timer kept counting.
- Turn the network back on → *Synced*. “Every change has an ID, so retries never duplicate, and if two phones disagree on a deadline the student chooses — nothing is silently overwritten.”

## 4:50 — Close (10 s)

> “NextStep: realistic plans, explained, and a next step whenever life gets in the way. Plans change. Keep moving. You can install it today from our website.”

## If something goes wrong

- The app is stuck on “Waking up the NextStep server” → wait up to a minute (free hosting sleeps); if it fails, play the video at `/demo`.
- No internet at the venue → the app keeps working offline with the account you signed in to beforehand (changes sync later); the video needs the page to have loaded once.
- AI features are optional and off without a server key — don’t demo them unless a key is configured.

## Claims to avoid

Don’t claim real users, pilots, partnerships, school endorsements, learning outcomes, awards or app-store availability (the APK is a direct download, not a Play Store listing). Say “built and tested by the team”, not “production-ready”. When mentioning data use, quote the measured numbers in [SYNC.md](SYNC.md) and say they were measured locally.
