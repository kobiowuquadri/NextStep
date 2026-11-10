import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { sceneSvg, mascotSvg } from '@nextstep/illustrations';
import { Art, ButtonLink, Card, PageHero, Section, SectionHead, reveal } from '@/components/ui';
import { PhoneShot } from '@/components/PhoneShot';
import { SCREENS } from '@/lib/screens';
import styles from '../pages.module.css';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'How NextStep turns deadlines, effort and real availability into an explainable plan, and how Recovery Mode rebuilds it when life changes.',
};

const STEPS = [
  {
    art: sceneSvg('onboardingOrganise'),
    title: 'Set up in a few minutes',
    body: 'Your name, timezone, a few courses, one or two upcoming tasks, when you can study, and fixed commitments like work, commute and lectures. Anything else can wait — and no school directory is required.',
  },
  {
    art: sceneSvg('onboardingPlan'),
    title: 'Get a realistic plan',
    body: 'NextStep splits work into sessions that fit your study windows, keeps buffers, respects your daily limit and protected rest, and never schedules over a commitment. Each priority comes with a plain reason.',
  },
  {
    art: sceneSvg('onboardingRecover'),
    title: 'Recover when life happens',
    body: 'Tap “My plans changed”. Review a before/after proposal with a smaller next step, then accept, adjust or keep your plan. Nothing changes until you decide.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="From “too much” to one next step."
        intro="NextStep’s planner is deterministic and explainable. It runs on your phone, works offline, and never needs AI to plan."
        art={<Art svg={mascotSvg({ pose: 'focus' })} />}
      />

      <Section labelledBy="steps-h">
        <SectionHead id="steps-h" eyebrow="The loop" title="Plan, focus, recover, reflect." />
        <ol className={styles.threeUp}>
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card revealAs="up" delay={i} className={styles.stepCard}>
                <Art svg={s.art} />
                <span className={styles.stepNo}>Step {i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="warm" labelledBy="rules-h">
        <SectionHead
          id="rules-h"
          eyebrow="The planner"
          title="How NextStep decides what comes next."
          intro="The same inputs always give the same plan. Here are the rules in plain language — the full technical version is in the project documentation."
        />
        <div className={styles.twoCol}>
          <Card revealAs="up" delay={0}>
            <h3 className={styles.h3}>What goes in</h3>
            <ul className={styles.bullets}>
              <li>Each task’s real deadline, remaining effort, importance, dependencies and whether it can be split.</li>
              <li>Your study windows — and which ones usually have internet.</li>
              <li>Fixed commitments (work, commute, lectures) and protected rest, worship or family time.</li>
              <li>Your preferred session length, daily limit and buffer time.</li>
              <li>Sessions you pinned and work you’ve already done.</li>
            </ul>
          </Card>
          <Card revealAs="up" delay={1}>
            <h3 className={styles.h3}>How it allocates</h3>
            <ul className={styles.bullets}>
              <li>Work due soonest is placed first — that keeps the most deadlines achievable. Tasks that unlock others inherit their deadline.</li>
              <li>Ties go to higher importance, then tasks already started.</li>
              <li>It aims to finish a buffer (12 hours by default) before each deadline, and flags work as “tight” if it can only fit inside that buffer.</li>
              <li>No more than two sessions of the same task per day, so work is spaced out.</li>
              <li>Tasks that need the internet only go into windows you marked as connected.</li>
              <li>Personal goals and tasks without deadlines fit around deadline work.</li>
            </ul>
          </Card>
          <Card revealAs="up" delay={2} tone="danger" className={styles.span2}>
            <h3 className={styles.h3}>When it doesn’t fit</h3>
            <p>
              NextStep never presents an impossible plan. It tells you how many minutes don’t fit before which deadline, then runs quick “what if” checks to
              offer concrete choices: reduce the scope, defer a lower-priority or optional task (and how much time that frees), allow a little more study on the
              days before the deadline, add a study window, or ask your lecturer, a tutor or classmates for help. It never moves the deadline itself.
            </p>
          </Card>
          <Card revealAs="up" delay={3} tone="primary" className={styles.span2}>
            <h3 className={styles.h3}>Prefer to plan by hand?</h3>
            <p>
              Switch to manual planning. You place sessions yourself, and NextStep only checks your plan: overlaps, clashes with commitments, work after a
              deadline, under-planned tasks and days over your limit.
            </p>
          </Card>
        </div>
      </Section>

      <Section labelledBy="recovery-h">
        <SectionHead
          id="recovery-h"
          eyebrow="Recovery Mode"
          title="Minimum change, maximum honesty."
          intro="Recovery keeps every unaffected session exactly where it is and only re-places the work that was displaced. It reshuffles more of your week only if that fits strictly more work before your deadlines."
        />
        <div className={styles.threeUp}>
          <Card revealAs="up" delay={0} tone="energy">
            <h3 className={styles.h3}>What you tell it</h3>
            <p>Missed a session · less time today · a deadline officially changed · something urgent · a lighter day. Only the details that matter.</p>
          </Card>
          <Card revealAs="up" delay={1}>
            <h3 className={styles.h3}>What you see</h3>
            <p>What stays, what moves, what is split or shortened, and what is now at risk — each with a reason — plus one smaller next step.</p>
          </Card>
          <Card revealAs="up" delay={2} tone="calm">
            <h3 className={styles.h3}>Safe to accept</h3>
            <p>
              Acceptance is all-or-nothing. If your plan changed while you were looking (say, on another device), NextStep rebuilds the proposal instead of
              overwriting your later edits. You can undo the latest change if you haven’t started its sessions.
            </p>
          </Card>
        </div>
        <h3 className={styles.inAppTitle} {...reveal('up')}>
          In the app
        </h3>
        <div className={styles.screenRow} tabIndex={0} role="region" aria-label="Recovery Mode in the NextStep Android app">
          {[SCREENS.recoveryReasons, SCREENS.recoveryTime, SCREENS.recoveryPreview, SCREENS.recoveryChoose].map((s, i) => (
            <div key={s.src} className={styles.screenItem} {...reveal('up', i)}>
              <PhoneShot screen={s} caption={`${i + 1}. ${s.label}`} size="sm" sizes="(max-width: 1200px) 230px, 18vw" />
            </div>
          ))}
        </div>
        <div className={styles.ctaRow}>
          <ButtonLink href="/demo/interactive" size="lg">
            Try Recovery Mode <ArrowRight size={20} aria-hidden />
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
