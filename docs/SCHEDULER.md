# Scheduler and Recovery Mode

Source: `packages/scheduler/src`. The planner is **deterministic**: the same inputs (tasks, sessions, availability, commitments, day overrides, preferences, clock, seed) always produce the same plan, the same session IDs and the same explanations. It has no I/O, takes the clock as input, and is shared by the mobile app, the API and the browser demo. Tests: `schedule.test.ts`, `recovery.test.ts` (35 tests).

## Inputs

| Input | Notes |
|---|---|
| Tasks | `dueAt` (optional), `importance` 1–4, `estimatedMinutes`, `remainingMinutes`, `dependsOn[]`, `splittable`, `preferredSessionMinutes`, `connectivity` (`offline`/`online`/`either`), `optional`, `goalId` (personal-goal tasks), status. |
| Sessions | Existing scheduled sessions with status `planned`/`done`/`missed`/`skipped`, `pinned` flag. |
| Availability | Weekly windows (weekday, start, end, `online` = “I usually have data here”). |
| Commitments | Classes, work, commute, family duties, rest — recurring by weekday or one-off; overnight commitments spill into the next morning. |
| Day overrides | Per-date replacement windows and/or a different daily maximum (created by Recovery Mode or the student). |
| Preferences | Defaults: session 45 min (min 20, max 90), daily limit 180 min, buffer 10 min, deadline buffer 12 h, max 2 sessions per task per day, timezone. |

## 1. Free time

For each local date in the horizon (default 14 days, in the student’s timezone, DST-safe):

1. Take the day override’s windows if one exists, otherwise the weekly availability windows; sort and clip overlaps so time is never counted twice.
2. Subtract commitments, protected rest and **kept sessions**, each padded by the buffer (10 min default) on both sides.
3. Clip to the future (rounded up to the next 5 minutes).
4. Day capacity = the override’s maximum if set, otherwise the daily limit.

**Kept sessions** are never moved by the planner: completed sessions, pinned sessions, sessions in progress right now, and (during Recovery) every session the change didn’t affect. Other future planned sessions are replaceable. Missed and past sessions are history.

## 2. Priority score (0–100)

Used for “what next?” suggestions, explanations and as a tie-breaker:

| Component | Points |
|---|---|
| Urgency | 0–50, linear: due now or overdue → 50; due in ≥ 7 days → 0 |
| Importance | 0–30: `(importance − 1) / 3 × 30` |
| Unlocks | 5 per open task that depends on this one (max 10) |
| Already started | +5 if status is in progress or remaining < estimate |
| Optional | −10 |

## 3. Allocation order

Tasks are grouped, then ordered:

1. **Group 0** — has a future (effective) deadline
2. **Group 1** — overdue (deadline passed)
3. **Group 2** — no deadline
4. **Group 3** — personal-goal time

Within a group: earliest **effective deadline** first (a task’s effective deadline is the earliest deadline of anything that depends on it, so prerequisites are planned early enough), then higher importance, higher score, older creation time, ID. Dependencies are respected with a topological sort (Kahn’s algorithm) using that comparison for ties. Dependency loops are detected; the planner ignores their order and warns the student instead of failing.

Earliest-deadline-first is what keeps the most work feasible; the score alone would not.

## 4. Placement

For each task in order, the planner walks the free slots from the earliest:

- **Session length** = the task’s preferred length, else the default, clamped to the student’s min/max.
- A task can’t start before its prerequisites’ last session ends (+ buffer). If a prerequisite doesn’t fully fit, the dependent task is **blocked**, not squeezed in.
- **Per-day caps**: the day’s remaining capacity, and at most `maxSessionsPerTaskPerDay` sessions of the same task per day (1 for no-deadline and goal tasks).
- **Online tasks** only go into windows marked as having data.
- **Non-splittable** tasks need one block that fits entirely in a slot and the day budget.
- A remainder smaller than half a minimum session is merged into the current session when it fits; otherwise chunks are rounded down to 5 minutes.
- **Deadline buffer passes** (group 0): first try to finish 12 h before the deadline; if work remains, a second pass may use the buffer window and marks the task **tight**.
- Goal tasks are placed only within the current week; no-deadline tasks across the horizon.
- After each placement the slot is split and the buffer is reserved around the new session.
- Session IDs are `stableUuid(seed, taskId, start, end)` where the seed is `userId:r<planRevision>` — replanning the same state gives the same IDs, but a new revision never reuses IDs of deleted sessions.
- If a subtask list exists, sessions get the open subtasks’ titles in order as labels (“Outline the essay”). Views recompute labels with `currentSessionLabels`: the open steps, in order, mapped onto the task’s remaining sessions — so after a missed session the next one shows the step that still needs doing, and ticked-off steps are skipped.

## 5. Status and explanations

Every task gets a status and a plain-language explanation:

| Status | Meaning |
|---|---|
| `on_track` | All remaining work fits before the deadline buffer. “On track: 3 sessions (2 h 15 min) planned, finishing Wed 18:30 — 2 days before the deadline.” |
| `tight` | Fits, but the last session falls inside the deadline buffer. |
| `at_risk` | Some work does not fit before the deadline. The shortfall in minutes is reported. |
| `blocked` | Waiting on a prerequisite that doesn’t fully fit. |
| `overdue` | Deadline passed. NextStep never moves it; the student decides to finish, update (only if it officially changed) or archive. |
| `flexible` | No deadline / personal goal. |

Reasons are listed most significant first: due date and relative day, importance if high, what it unlocks, what it waits for, percentage done, “needs internet”, optional.

## 6. When it doesn’t fit (shortfall)

The planner **never pretends an impossible week works**. When any task with a deadline is `at_risk`/`blocked`, the plan carries a shortfall (“3 h 20 min of work doesn’t fit before 2 deadlines”) and concrete options, each computed by re-running the planner as a what-if:

1. **Reduce scope** of the at-risk task by the shortfall (always resolves).
2. **Defer** up to three lower-priority tasks that currently use time before the deadline (optional, lower importance or no deadline; never one of its prerequisites). Shows the minutes actually gained and whether that fully resolves it.
3. **Raise the daily limit** by 60 min (max 10 h) on days before the deadline, excluding days the student already lightened — shown only if it gains time, with “only if it’s genuinely sustainable”.
4. **Add study time**, pointing out empty days before the deadline.
5. **Ask for help or clarity** (lecturer, tutor, classmate, extension request) — NextStep never changes a real deadline itself.

Options are evaluated for the two most at-risk tasks.

## 7. Manual and hybrid planning

Students can choose automatic, manual or hybrid planning, add sessions by hand, pin sessions so the planner never moves them, and move/delete sessions. `analyzePlan` checks a manual plan without changing it: overlapping sessions, sessions on top of commitments, work placed after a deadline, under-planned tasks, and days over the limit.

## 8. Today view

`buildToday` shows at most three next actions from today’s remaining sessions (in-progress first), today’s done count and minutes, the next four deadlines, “completed for today” and “rest day” states, and sessions missed in the last three days — excluding ones that ended before the student’s latest replan, so a missed session is only raised once. An optional “if you have energy” suggestion is offered but **never** added automatically.

## 9. Recovery Mode

Entry: **“My plans changed”** on Today, a missed-session prompt, or the Plan tab. The student picks what happened:

| Change | What NextStep does to a copy of the state |
|---|---|
| Missed a session | Marks it missed; optional “I did N minutes” reduces remaining effort. |
| Less time today | Day override with the stated minutes (e.g. 45). |
| Lighter day | Day override with a lower maximum. |
| Something urgent | Blocks 1–N days completely (override with 0 minutes). |
| Deadline changed | Uses the new deadline **the student entered** — only for officially changed deadlines. NextStep never invents or silently extends one. |

### Building the proposal

1. Fingerprint the current planning state and note the plan revision.
2. Apply the change to a copy and work out which sessions it directly affects.
3. **Local strategy**: lock every unaffected upcoming session and re-place only the displaced work.
4. **Global strategy**: replan everything that isn’t pinned/done/in progress.
5. Use global **only if it fits strictly more work** before deadlines; otherwise local (minimum disruption).
6. Diff before vs after per task and classify each change — *shortened*, *split* (more sessions and ≥ 15 % shorter on average), *moved*, *added*, *removed* — with a reason (“Thu now has 45 min, so this moves to Fri 10:00”, “Moved to Sat 9:00 to make room for work due sooner”, “Catching up on the missed session”).
7. Report the **smallest next step** (first upcoming session), what’s still at risk with the same shortfall options as above, and a supportive headline (“You still have a next step.”).

### Accept / adjust / keep / undo

- **Preview first**: nothing changes until the student accepts.
- **Accept** checks freshness first: the plan revision must be unchanged, the planning-input fingerprint must match, and no proposed session may start more than 5 minutes in the past. A stale preview is rejected and rebuilt.
- Acceptance is **one transaction**: new plan revision (with a snapshot), session status changes, overrides, task updates, replaced sessions tombstoned, new sessions created, proposal stored as accepted, `recovery_accepted` XP (capped at 2 per day).
- On the server the same freshness checks run (`/v1/recovery/accept`), and sync uses `basePlanRevision` + a unique `(userId, revision number)` so two devices can’t both apply a recovery onto the same base — the second gets a `STALE_PLAN` conflict.
- **Keep current plan** records the decision and changes nothing.
- **Adjust** returns to the input step with values kept.
- **Undo** restores the snapshot as a new revision. Restored sessions get new IDs so they never collide with tombstones on other devices.
- Completing the proposal’s next action (via focus or a matching subtask) awards **Back on Track** once.
