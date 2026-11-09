'use client';

import { useState } from 'react';
import { CalendarDays, CheckCircle2, Circle, Compass, House, RotateCcw, TriangleAlert } from 'lucide-react';
import type { RecoveryInput } from '@nextstep/contracts';
import { DEMO_LABEL } from '@nextstep/demo-data';
import { Celebration } from './Celebration';
import { CheckIn } from './CheckIn';
import { JourneyView } from './Journey';
import { PlanView } from './Plan';
import { Practice } from './Practice';
import { RecoveryFlow } from './Recovery';
import { Sheet } from './Sheet';
import { TaskEditor } from './TaskEditor';
import { TodayView } from './Today';
import { formatInstant } from './shared';
import { DemoProvider, GUIDE, useDemo } from './store';
import styles from './demo.module.css';

type Tab = 'today' | 'plan' | 'journey';

export interface Opener {
  tab: (t: Tab) => void;
  recovery: (initial?: Partial<RecoveryInput> & { kind?: RecoveryInput['kind'] }) => void;
  task: (id?: string) => void;
  checkIn: (sessionId: string) => void;
}

type SheetState =
  | { type: 'recovery'; initial?: Partial<RecoveryInput> & { kind?: RecoveryInput['kind'] }; key: number }
  | { type: 'task'; id?: string; key: number }
  | { type: 'checkin'; sessionId: string; key: number }
  | { type: 'practice'; resourceId: string; key: number }
  | null;

function DemoShell() {
  const demo = useDemo();
  const [tab, setTab] = useState<Tab>('today');
  const [sheet, setSheet] = useState<SheetState>(null);
  const close = () => setSheet(null);
  const open: Opener = {
    tab: setTab,
    recovery: (initial) => setSheet({ type: 'recovery', initial, key: Date.now() }),
    task: (id) => setSheet({ type: 'task', id, key: Date.now() }),
    checkIn: (sessionId) => setSheet({ type: 'checkin', sessionId, key: Date.now() }),
  };
  const doneCount = GUIDE.filter((g) => demo.guide[g.id]).length;
  const tabs: Array<{ id: Tab; label: string; Icon: typeof House }> = [
    { id: 'today', label: 'Today', Icon: House },
    { id: 'plan', label: 'Plan', Icon: CalendarDays },
    { id: 'journey', label: 'Journey', Icon: Compass },
  ];

  return (
    <div className={styles.demoPage}>
      <div className={styles.banner} role="note">
        <span className={styles.bannerTag}>Demo</span>
        <span className={styles.bannerText}>
          {DEMO_LABEL} Changes stay in this browser. Demo clock: <strong>{formatInstant(demo.clock, 'Africa/Lagos')}</strong> (Lagos).
        </span>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSmall}`}
          onClick={() => {
            if (window.confirm('Reset the demo to Tobi’s original week? Your changes in this browser will be cleared.')) demo.reset(false);
          }}
        >
          <RotateCcw size={16} aria-hidden /> Reset demo
        </button>
      </div>

      <div className={styles.demoLayout}>
        <aside className={styles.guide} aria-labelledby="guide-h">
          <h1 id="guide-h" className={styles.guideTitle}>
            Try Tobi’s week
          </h1>
          <p className={styles.muted}>
            {doneCount} of {GUIDE.length} done. Follow the steps in any order.
          </p>
          <ol className={styles.guideList}>
            {GUIDE.map((g) => (
              <li key={g.id} className={demo.guide[g.id] ? styles.guideDone : ''}>
                {demo.guide[g.id] ? <CheckCircle2 size={20} aria-hidden /> : <Circle size={20} aria-hidden />}
                <span>{g.label}</span>
                <span className="visually-hidden">{demo.guide[g.id] ? '(done)' : '(not yet)'}</span>
              </li>
            ))}
          </ol>
          <div className={styles.guideHint}>
            <p>
              <strong>Tip:</strong> on Today, tap <em>My plans changed → I have less time</em> and pick 45 minutes.
            </p>
          </div>
          <div className={styles.guideHint}>
            <p>
              <TriangleAlert size={16} aria-hidden /> <strong>See an overloaded week:</strong> load a version where the work can’t fit, and see how NextStep explains the shortfall.
            </p>
            <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnSecondary}`} onClick={() => demo.reset(!demo.overloaded)}>
              {demo.overloaded ? 'Back to the normal week' : 'Load overloaded week'}
            </button>
          </div>
        </aside>

        <div className={styles.device}>
          <div className={styles.screen} aria-label="NextStep demo app">
            <div className={styles.screenScroll}>
              {tab === 'today' && <TodayView open={open} />}
              {tab === 'plan' && <PlanView open={open} />}
              {tab === 'journey' && <JourneyView />}
            </div>
            <nav className={styles.tabBar} aria-label="Demo app tabs">
              {tabs.map(({ id, label, Icon }) => (
                <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
                  <Icon size={22} aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>
          <p className={styles.deviceNote}>The mobile app also has Focus and Profile tabs, offline sync and settings. This demo focuses on the core planning and recovery loop.</p>
        </div>
      </div>

      <div className={styles.toasts} aria-live="polite">
        {demo.toasts.map((t) => (
          <p key={t.id} className={`${styles.toast} ${styles['toast_' + t.tone]}`}>
            {t.text}
          </p>
        ))}
      </div>

      <Sheet open={sheet?.type === 'recovery'} onClose={close} title="My plans changed" wide>
        {sheet?.type === 'recovery' && <RecoveryFlow key={sheet.key} initial={sheet.initial} onClose={close} onStartNext={(id) => setSheet({ type: 'checkin', sessionId: id, key: Date.now() })} />}
      </Sheet>
      <Sheet open={sheet?.type === 'task'} onClose={close} title={sheet?.type === 'task' && sheet.id ? 'Task' : 'New task'}>
        {sheet?.type === 'task' && <TaskEditor key={sheet.key} taskId={sheet.id} onClose={close} onPractice={(resourceId) => setSheet({ type: 'practice', resourceId, key: Date.now() })} />}
      </Sheet>
      <Sheet open={sheet?.type === 'checkin'} onClose={close} title="Session check-in">
        {sheet?.type === 'checkin' && <CheckIn key={sheet.key} sessionId={sheet.sessionId} onClose={close} />}
      </Sheet>
      <Sheet open={sheet?.type === 'practice'} onClose={close} title="Practice check">
        {sheet?.type === 'practice' && <Practice key={sheet.key} resourceId={sheet.resourceId} onClose={close} />}
      </Sheet>
      <Celebration />
    </div>
  );
}

export default function DemoApp() {
  return (
    <DemoProvider>
      <DemoShell />
    </DemoProvider>
  );
}
