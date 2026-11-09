# Gamification rules

Source: `packages/gamification/src` (rules, ledger, levels, quests, achievements, cosmetics) and server verification in `apps/api/src/sync/xp-verifier.ts`. Tests: `gamification.test.ts` (15 tests) plus API integration tests for duplicate and invalid awards.

## Principles

- Reward **meaningful progress**, recovery, reflection and healthy breaks — never time in the app, volume of taps or lots of tiny tasks.
- **No punishment**: nothing ever removes XP, resets a level or shames a missed day. Disruption is handled by Recovery Mode, not penalties.
- **Weekly, not daily, streaks**, and they can be turned off.
- Rewards are **cosmetic only**: mascot skins and accessories. No learning, planning or accessibility feature is gated.
- The student can see exactly how every reward is earned (Journey → “How XP works”).
- Celebrations, haptics and sound are optional; sound is off by default; reduced motion is respected.

## XP rules

Every award has a **dedupe key** — replaying, re-syncing, toggling a step off and on, or two devices doing the same thing never awards twice. Daily caps use the **local date when the action happened**, so syncing a day late never costs XP.

| Event | XP | Once per (dedupe key) | Daily cap |
|---|---|---|---|
| Task completed | 10 + 5 per 30 min of estimated effort (estimate counted up to 180 min; max 40). Tasks estimated under 10 min, or completed within 5 min of creation, earn 5. Personal-goal tasks earn through goal check-ins instead. | task | 200 XP |
| Step (subtask) completed | 3 | subtask | 30 XP |
| Focus logged | 1 per 5 focused minutes, counted up to 60 min (max 12), +2 for taking a break. Under 10 min earns 0 but still counts as activity. | focus log | 60 XP |
| After-session check-in | 5 | focus log | 25 XP |
| Recovery plan accepted | 15 | proposal | 2 per day |
| Back on track (completed the recovery plan’s next action) | 20 | proposal | — |
| Weekly reflection | 30 | week | — |
| Personal goal check-in | 5 | goal + date | 10 XP |
| Practice check finished | 8 the first time; retakes earn nothing extra | resource | — |
| Quest completed | Daily quest 10, weekly quest 25 | quest instance | — |
| Welcome back | 10 after 3+ days away | date | — |
| First plan | 10 | once ever | — |

When a cap is reached the event is still recorded (with reduced or zero XP) so progress stays visible, and the student is told it was capped.

## Levels

Cumulative XP for level *n* = 25 · (n − 1) · (n + 2): **L2 100, L3 250, L4 450, L5 700, L6 1000**, growing gently. Names: Trailhead, First Steps, Path Finder, Steady Stride, Bridge Builder, Hill Climber, Route Planner, Comeback Captain, Trail Blazer, Ridge Walker, Summit Seeker, Horizon Keeper.

## Steady weeks (instead of daily streaks)

An **active day** has at least one of: task or step completed, focus logged, check-in, goal check-in, practice finished. The student picks a weekly goal (default 4 active days). The steady-week count is the number of consecutive weeks meeting that goal; the current week counts once met. Missing a day never resets anything; an unmet week only pauses the count. Streak display can be switched off.

## Quests

- **Daily**: up to three, picked deterministically per date from: *Show up once* (one 10+ min focus session), *Close the loop* (a check-in), *One small step* (a step or task), *Rest counts* (a break), *Something for you* (goal check-in — only if a goal is active). On a lighter day (override below half the daily limit) only **one** gentle quest is offered.
- **Weekly**: *Three good sessions*, *Look back, plan forward* (reflection), *Keep a promise to yourself* (goal check-ins on two days; only with an active goal).
- Quests are claimed automatically, once per instance (`daily:<date>:<id>` / `weekly:<weekStart>:<id>`).

## Achievements

| Badge | Rule | Cosmetic reward |
|---|---|---|
| First Step | Complete a full-XP task, or a focus session of 10+ min | Headphones |
| Back on Track | Accept a recovery plan and complete its next action | Coral skin |
| Weekly Reflection | Complete a weekly reflection | Midnight skin |
| Steady Progress | Meet your weekly active-days goal once | Mint skin |
| Small Wins | Finish 8 meaningful steps (subtasks or full-XP tasks) | Star pin |
| Map Maker | Build your first plan | Backpack |
| Rest Respected | Take a break after 5 focus sessions | Scarf |
| Curious Mind | Finish 3 different practice checks | Glasses |
| Welcome Back | Return after 3+ days away | Lagoon skin |
| Bridge Builder | Reach level 5 (700 XP) | Marigold skin |

Level rewards: cap at level 3, graduation cap at level 6. Achievements unlock once (unique per user on the server).

## Anti-farming

- Dedupe keys on every award; unique `(userId, dedupeKey)` constraint on the server.
- Quick tasks (< 10 min estimate or done < 5 min after creation) earn the minimum.
- Focus beyond 60 minutes in one session isn’t rewarded further; breaks are.
- Daily caps per event type; recovery acceptance capped at 2/day.
- Practice retakes and repeated toggling earn nothing.

## Offline and server authority

- On the phone, awards are computed immediately with the same rules and stored as **pending** events in the local ledger, so XP, levels and celebrations work offline.
- When synced, the **server ignores the client’s XP number**. It checks that the underlying activity exists in its own data (task is done, focus log exists, proposal was accepted, quest really complete…), recomputes the award with the shared rules and the action’s local date, and stores the confirmed amount. The client adopts the server’s value.
- A duplicate (same dedupe key from another device) returns the existing confirmed event — no double XP.
- An award the server can’t verify is rejected with a reason and excluded from totals; nothing else is taken away.
- Future-dated events (> 5 min ahead of server time) are rejected.
