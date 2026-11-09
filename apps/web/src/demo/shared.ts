export {
  addDaysToKey,
  formatDateKey,
  formatInstant,
  formatMinutes,
  formatTimeOfDay,
  instantAt,
  localDateKey,
  relativeDay,
  weekdayOfKey,
  type Commitment,
  type Course,
  type Task,
} from '@nextstep/contracts';
import { weekdayOfKey, type Commitment } from '@nextstep/contracts';

export function commitmentOccursOnDate(c: Commitment, date: string): boolean {
  if (c.date) return c.date === date;
  return c.weekdays.includes(weekdayOfKey(date));
}

export const STATUS_META: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'calm' | 'muted' }> = {
  on_track: { label: 'On track', tone: 'success' },
  tight: { label: 'Tight', tone: 'warning' },
  at_risk: { label: 'At risk', tone: 'danger' },
  blocked: { label: 'Waiting', tone: 'warning' },
  overdue: { label: 'Overdue', tone: 'danger' },
  flexible: { label: 'Flexible', tone: 'calm' },
  done: { label: 'Done', tone: 'success' },
};

export const KIND_LABEL: Record<string, string> = {
  assignment: 'Assignment',
  exam: 'Exam / test',
  revision: 'Revision',
  reading: 'Reading',
  project: 'Project',
  practice: 'Practice',
  personal: 'Personal',
};
