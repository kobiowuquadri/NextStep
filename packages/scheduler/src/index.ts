export * from './types.js';
export { generatePlan, allocate, planFingerprint, shortfallOptions, summarise } from './schedule.js';
export { analyzePlan, type PlanIssue } from './analyze.js';
export {
  applyRecoveryInput,
  buildRecoveryProposal,
  checkProposalFresh,
  diffPlans,
  type ChangeKind,
  type RecoveryChange,
  type RecoveryProposal,
  type RecoveryStateChanges,
  type SessionRef,
  type StaleReason,
} from './recovery.js';
export { buildToday, currentSessionLabels, optionalExtra, type TodayAction, type TodayView } from './today.js';
export { scoreTask, reasonsFor, importanceLabel } from './priority.js';
export { buildFreeTime, subtract, overlaps, commitmentIntervals, type Interval, type FreeSlot } from './slots.js';
