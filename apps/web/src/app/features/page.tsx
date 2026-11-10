import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { mascotSvg } from '@nextstep/illustrations';
import { Art, ButtonLink, Eyebrow, PageHero, Section, SectionHead, reveal } from '@/components/ui';
import { PhoneShot } from '@/components/PhoneShot';
import { DownloadAvailability } from '@/components/DownloadAvailability';
import { SCREENS, type AppScreen } from '@/lib/screens';
import styles from '../pages.module.css';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Today dashboard, explainable planner, Recovery Mode, focus sessions, journey and quests, weekly reflection, personal goals and offline resources.',
};

/** One or two real screens for a feature row; the second one sits behind, offset. */
function Shots({ main, back }: { main: AppScreen; back?: AppScreen }) {
  return (
    <div className={`${styles.shots} ${back ? styles.shotsPair : ''}`}>
      {back && (
        <div className={styles.shotBack}>
          <PhoneShot screen={back} size="sm" tilt={-5} sizes="230px" />
        </div>
      )}
      <div className={styles.shotMain}>
        <PhoneShot screen={main} tilt={back ? 3 : 0} sizes="(max-width: 700px) 66vw, 290px" />
      </div>
    </div>
  );
}

const FEATURES: {
  eyebrow: string;
  title: string;
  body: string;
  visual: ReactNode;
}[] = [
  {
    eyebrow: 'Today',
    title: 'Only what’s realistic today.',
    body: 'A greeting, your level, the next session with the reason it matters, upcoming deadlines and a quick add. If sessions didn’t happen, you get a calm way to find a new time. When you’re done, NextStep says so instead of inventing more work.',
    visual: <Shots main={SCREENS.today} back={SCREENS.todayDone} />,
  },
  {
    eyebrow: 'Plan',
    title: 'A week that fits around your life.',
    body: 'Sessions sit between work, commute, lectures and protected rest. Each day shows its load against your limit, and every task says whether it’s on track. Pin a session to keep it in place, or switch to manual planning and NextStep will only check your plan for clashes.',
    visual: <Shots main={SCREENS.plan} back={SCREENS.planTasks} />,
  },
  {
    eyebrow: 'Recovery Mode',
    title: 'One tap when plans change.',
    body: 'Missed a session, less time, a changed deadline, something urgent or a lighter day. See exactly what stays, moves, splits or is at risk — with reasons — then accept, adjust or keep your plan.',
    visual: <Shots main={SCREENS.recoveryPreview} back={SCREENS.recoveryReasons} />,
  },
  {
    eyebrow: 'Focus',
    title: 'A timer that survives real life.',
    body: 'Start, pause, take a break and finish. The timer is stored as timestamps, so it survives switching apps and restarting your phone. Afterwards: what did you finish, how much is left, and do you need more practice? Prefer not to time? Log it manually.',
    visual: <Shots main={SCREENS.focus} back={SCREENS.checkin} />,
  },
  {
    eyebrow: 'Journey',
    title: 'Progress you can see, rules you can read.',
    body: 'XP, levels, daily and weekly quests and badges for real steps — like finishing a recovery plan’s next action. Style Nex with cosmetic rewards. Streaks are weekly and optional; celebrations and animations can be switched off.',
    visual: <Shots main={SCREENS.journey} back={SCREENS.badges} />,
  },
  {
    eyebrow: 'Reflection',
    title: 'A kinder weekly review.',
    body: 'Planned versus done, estimated versus actual time, what got in the way and how many times you restarted. NextStep suggests a more realistic next week — and is clear that logged activity is not the same as grades.',
    visual: <Shots main={SCREENS.reflection} />,
  },
  {
    eyebrow: 'Goals & resources',
    title: 'Room for you, and material that works offline.',
    body: 'Add one or two personal goals — reading, exercise, a career skill — and NextStep fits them around deadlines. Download short practice checks with explanations; the size is shown before you download, and downloaded items are clearly marked.',
    visual: <Shots main={SCREENS.practice} back={SCREENS.resources} />,
  },
];

const MORE = [SCREENS.welcome, SCREENS.taskEditor, SCREENS.recoveryTime, SCREENS.levelUp, SCREENS.profile];
const DARK = [SCREENS.darkToday, SCREENS.darkPlan, SCREENS.darkRecovery, SCREENS.darkJourney];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Explore the app"
        title="Built around your next step."
        intro="The NextStep mobile app (Android first, then iOS) works offline after setup and syncs when you reconnect. Every screen on this page is captured from the Android release build with the fictional sample semester — not a mock-up."
        art={<Art svg={mascotSvg({ pose: 'welcome', accessory: 'backpack' })} />}
      />
      <Section>
        {FEATURES.map((f) => (
          <article key={f.title} className={styles.featureRow}>
            <div className={styles.featureCopy} {...reveal('up')}>
              <Eyebrow tone="primary">{f.eyebrow}</Eyebrow>
              <h2>{f.title}</h2>
              <p>{f.body}</p>
            </div>
            <div {...reveal('scale', 1)}>{f.visual}</div>
          </article>
        ))}
      </Section>

      <Section tone="warm" labelledBy="more-h">
        <SectionHead
          id="more-h"
          eyebrow="More from the app"
          title="Small screens, carefully made."
          intro="Getting started, adding a task, choosing how much time you have, levelling up and your settings."
        />
        <div className={styles.screenRow} tabIndex={0} role="region" aria-label="More screens from the NextStep Android app">
          {MORE.map((s, i) => (
            <div key={s.src} className={styles.screenItem} {...reveal('up', i)}>
              <PhoneShot screen={s} caption={s.label} size="sm" sizes="(max-width: 1200px) 230px, 15vw" />
            </div>
          ))}
        </div>
      </Section>

      <Section tone="ink" labelledBy="dark-h">
        <SectionHead
          id="dark-h"
          eyebrow="Dark theme"
          title="Easy on the eyes at night."
          intro="Choose light, dark or follow your phone. Captured from the same build."
        />
        <div className={styles.screenRow} tabIndex={0} role="region" aria-label="Dark theme screens">
          {DARK.map((s, i) => (
            <div key={s.src} className={styles.screenItem} {...reveal('up', i)}>
              <PhoneShot screen={s} caption={s.label} size="sm" tilt={i % 2 ? 2 : -2} sizes="(max-width: 1200px) 230px, 18vw" />
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className={styles.ctaRow} style={{ marginTop: 0 }}>
          <ButtonLink href="/demo" size="lg">
            Watch the demo <ArrowRight size={20} aria-hidden />
          </ButtonLink>
        </div>
        <DownloadAvailability />
      </Section>
    </>
  );
}
