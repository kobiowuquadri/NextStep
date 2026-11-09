/**
 * Real screenshots of the NextStep Android app (release build, Android 16 emulator,
 * fictional sample semester, 9 Nov 2026). Captured with `adb exec-out screencap`,
 * resized to 720×1600 and saved as WebP — content is not edited. See docs/ASSET_MANIFEST.md.
 */
export type AppScreen = { src: string; alt: string; label: string };

const s = (file: string, label: string, alt: string): AppScreen => ({
  src: `/screens/app/${file}.webp`,
  label,
  alt,
});

export const SCREENS = {
  welcome: s(
    'welcome',
    'Welcome',
    'NextStep welcome screen with Nex the mascot, “Everything in one calm place”, and buttons to create an account, sign in, continue as a guest or explore a sample semester.',
  ),
  today: s(
    'today',
    'Today',
    'Today screen for Tobi: level 1 progress, a card saying two sessions didn’t happen with “Find a new time”, and the next session at 19:00 with the reasons it matters.',
  ),
  todayDone: s(
    'today-done',
    'Done for today',
    'Today screen after finishing the session: Nex resting and “That’s today done. Rest counts too — NextStep won’t pile on more.”',
  ),
  plan: s('plan', 'Plan', 'Plan screen showing Monday: a shift at the print shop, the bus home, and four study sessions, with 2 h of 2 h planned.'),
  planTasks: s('plan-tasks', 'Tasks', 'Tasks list with five open tasks, each showing time left and an “On track” status with how many sessions are planned.'),
  recoveryReasons: s(
    'recovery-reasons',
    'My plans changed',
    'My plans changed sheet listing five options: I missed a session, I have less time, a deadline changed, something urgent came up, I need a lighter day.',
  ),
  recoveryTime: s(
    'recovery-time',
    'How much time?',
    'Recovery step asking how much time Tobi really has today, with 45 minutes selected and a “Show me the new plan” button.',
  ),
  recoveryPreview: s(
    'recovery-preview',
    'Recovery preview',
    'Recovery preview: “You have less time than planned. Here are your options.” The next step is 45 minutes on “Implement insert and delete”, followed by each change with before, after and a reason.',
  ),
  recoveryChoose: s(
    'recovery-choose',
    'Accept or keep',
    'End of the recovery preview with what stays the same and three choices: Accept changes, Adjust proposal, or Keep my current plan.',
  ),
  badge: s('badge', 'Back on Track', 'Badge unlocked dialog: Back on Track — “Plans changed and you kept moving.”'),
  levelUp: s('levelup', 'Level up', 'Level up dialog: Nex celebrating and “Level 2 — Every step counted.”'),
  focus: s('focus', 'Focus', 'Focus timer counting down 44:19 on “Write test cases”, with Pause, Take a break and Finish and check in.'),
  checkin: s(
    'checkin',
    'Check-in',
    'Check-in after a session: 45 minutes focused, “Implement insert and delete” ticked as finished, 135 minutes left and “Ready” selected.',
  ),
  journey: s('journey', 'Journey', 'Journey screen: level 2 “First Steps”, the level path from Trailhead to Hill Climber, and steady weeks.'),
  badges: s('badges', 'Badges', 'Journey badges: First Step and Back on Track earned, others locked, each with how to earn it.'),
  reflection: s(
    'reflection',
    'Weekly reflection',
    'Weekly reflection: planned versus done time, logged focus, restarts, a suggestion for next week, and what got in the way.',
  ),
  resources: s('resources', 'Resources', 'Resources list with sizes shown before download; one practice guide downloaded and available offline.'),
  practice: s(
    'practice',
    'Practice check',
    'A practice check on linked lists with both answers correct and an explanation for each — “not a grade or a measure of mastery”.',
  ),
  taskEditor: s('task-editor', 'New task', 'New task form: title, notes, type, course, deadline, due date and effort.'),
  profile: s('profile', 'Profile', 'Profile and settings: planning and preferences, study time and commitments, courses, personal goals, resources and sync.'),
  darkToday: s('dark-today', 'Today · dark', 'Today screen in the dark theme after finishing the day’s session.'),
  darkPlan: s('dark-plan', 'Plan · dark', 'Plan screen in the dark theme.'),
  darkJourney: s('dark-journey', 'Journey · dark', 'Journey screen in the dark theme.'),
  darkRecovery: s('dark-recovery', 'Recovery · dark', 'My plans changed sheet in the dark theme.'),
} satisfies Record<string, AppScreen>;
