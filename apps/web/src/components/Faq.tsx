import { ChevronDown } from 'lucide-react';
import styles from './faq.module.css';

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: FaqItem[] = [
  {
    q: 'Is NextStep available to download?',
    a: 'Not yet. The Android and iOS apps are not published in any app store yet; this site will link to real builds once Team Apex releases them. Meanwhile, the demo video shows the real Android app, and the interactive browser demo lets you try the core experience. Both use fictional data.',
  },
  {
    q: 'Does NextStep work without internet?',
    a: 'After you set up your account and first sync, yes: your tasks, plans, focus timer, Recovery Mode and downloaded resources work offline, and changes sync when you reconnect. Signing up, syncing between devices, downloading new resources and optional AI suggestions need a connection.',
  },
  {
    q: 'Will NextStep move my deadlines?',
    a: 'Never. A task’s real deadline only changes when you change it. NextStep moves the work sessions you plan to do before the deadline, and if work cannot fit, it tells you how much is short and what your options are.',
  },
  {
    q: 'What happens if I miss a session?',
    a: 'Nothing bad. Tap “My plans changed → I missed a session”. NextStep proposes where that work can go, shows you exactly what changes, and lets you accept, adjust or keep your current plan.',
  },
  {
    q: 'Do I need AI for planning?',
    a: 'No. Planning and Recovery Mode run on a deterministic, explainable scheduler on your device. Optional AI suggestions (like breaking a task into steps) only appear if the service is configured, and you always review them before anything is saved.',
  },
  {
    q: 'Does using NextStep improve my grades?',
    a: 'We don’t claim that. NextStep helps you plan and keep going; it records the activity you log, which is not the same as learning or results. We have not run studies of learning outcomes.',
  },
  {
    q: 'Are there leaderboards or streak penalties?',
    a: 'No leaderboards, no public profiles and no penalties. Progress is weekly rather than daily, missing a day never erases anything, and you can switch streaks and celebrations off.',
  },
  {
    q: 'What data do you collect?',
    a: 'Only what planning needs: a display name, email for your account, your timezone, and the courses, tasks and availability you enter. No advertising trackers. You can export or delete your account from the app. See the privacy page for details.',
  },
  {
    q: 'Can my school or lecturer see my plan?',
    a: 'No. There is no educator sharing in this release and no public links to your records.',
  },
  {
    q: 'Is NextStep connected to my university or a sponsor?',
    a: 'No. NextStep is an independent project by Team Apex. It has no school endorsements or community partnerships at this stage.',
  },
  {
    q: 'Who wrote the learning resources?',
    a: 'The sample resources were written by Team Apex for demonstration. They are marked as not reviewed by an educator, so check them against your own course materials.',
  },
];

export function FaqList({ items, columns = 1 }: { items: FaqItem[]; columns?: 1 | 2 }) {
  return (
    <div className={`${styles.list} ${columns === 2 ? styles.two : ''}`}>
      {items.map((item) => (
        <details key={item.q} className={styles.item}>
          <summary className={styles.summary}>
            <span>{item.q}</span>
            <ChevronDown aria-hidden className={styles.chev} />
          </summary>
          <p className={styles.answer}>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
