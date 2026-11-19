import { isValidTimezone, type TaskKind } from '@nextstep/contracts';
import type { SelectOption } from '../ui/forms';

/** Common timezones, grouped loosely by region. Students pick from a list instead of typing an IANA name. */
const COMMON_TIMEZONES = [
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Abidjan',
  'Africa/Dakar',
  'Africa/Douala',
  'Africa/Kinshasa',
  'Africa/Cairo',
  'Africa/Casablanca',
  'Africa/Nairobi',
  'Africa/Kampala',
  'Africa/Dar_es_Salaam',
  'Africa/Addis_Ababa',
  'Africa/Kigali',
  'Africa/Lusaka',
  'Africa/Harare',
  'Africa/Johannesburg',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Jakarta',
  'Asia/Singapore',
  'Asia/Manila',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
  'America/New_York',
  'America/Toronto',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'UTC',
];

const city = (tz: string) => (tz === 'UTC' ? 'UTC' : tz.split('/').pop()!.replace(/_/g, ' '));

/** Timezone options: the phone's own zone first, then the common list. Unknown zones are left out. */
export function timezoneOptions(deviceTz: string, current?: string): Array<SelectOption<string>> {
  const zones = [...new Set([deviceTz, current, ...COMMON_TIMEZONES].filter((z): z is string => !!z && isValidTimezone(z)))];
  return zones.map((tz) => ({ value: tz, label: city(tz), hint: tz === deviceTz ? `${tz} · from your phone` : tz }));
}

/** Universities, polytechnics and colleges students in Lagos and across Nigeria often attend. Free text is still allowed. */
export const INSTITUTIONS = [
  'University of Lagos',
  'Lagos State University',
  'Yaba College of Technology',
  'Lagos State University of Science and Technology',
  'University of Ibadan',
  'Obafemi Awolowo University',
  'Covenant University',
  'Pan-Atlantic University',
  'University of Nigeria, Nsukka',
  'Ahmadu Bello University',
  'University of Benin',
  'University of Ilorin',
  'University of Port Harcourt',
  'Nnamdi Azikiwe University',
  'Federal University of Technology, Akure',
  'Federal University of Technology, Minna',
  'Federal University of Agriculture, Abeokuta',
  'Olabisi Onabanjo University',
  'Babcock University',
  'National Open University of Nigeria',
];

export const COURSE_IDEAS = [
  'Data Structures',
  'Introduction to Programming',
  'Calculus',
  'Linear Algebra',
  'Statistics',
  'Physics',
  'Chemistry',
  'Biology',
  'Economics',
  'Accounting',
  'Business Management',
  'Use of English',
  'General Studies',
  'Engineering Mathematics',
  'Computer Architecture',
  'Databases',
];

export const KIND_LABEL: Record<TaskKind, string> = {
  assignment: 'Assignment',
  exam: 'Exam / test',
  revision: 'Revision',
  reading: 'Reading',
  project: 'Project',
  practice: 'Practice',
  personal: 'Personal',
};

/** Starting points for a task title, by type. The course code is added when there is one. */
export function taskTitleIdeas(kind: TaskKind, courseCode?: string | null): string[] {
  const ideas: Record<TaskKind, string[]> = {
    assignment: ['Assignment', 'Lab report', 'Problem set', 'Essay'],
    exam: ['Mid-semester test', 'Final exam', 'Quiz'],
    revision: ['Revise lecture notes', 'Past questions', 'Revision for test'],
    reading: ['Read chapter', 'Course reading', 'Lecture slides'],
    project: ['Group project', 'Presentation', 'Final year project'],
    practice: ['Practice questions', 'Past questions', 'Exercises'],
    personal: [],
  };
  return ideas[kind].map((t) => (courseCode ? `${courseCode} ${t.charAt(0).toLowerCase()}${t.slice(1)}` : t));
}

export const GOAL_IDEAS: Record<'reading' | 'exercise' | 'skill' | 'wellbeing' | 'other', string[]> = {
  reading: ['Read for fun', 'Read a novel', 'Read the news'],
  exercise: ['Morning walk', 'Football', 'Stretching', 'Gym'],
  skill: ['Coding practice', 'Learn Excel', 'Learn design', 'Public speaking'],
  wellbeing: ['Journal', 'Quiet time', 'Call family'],
  other: [],
};

export const COMMITMENT_NAMES: Record<'work' | 'class' | 'commute' | 'family' | 'rest' | 'worship' | 'other', string> = {
  work: 'Work',
  class: 'Lectures',
  commute: 'Commute',
  family: 'Family time',
  rest: 'Rest',
  worship: 'Worship',
  other: 'Commitment',
};
