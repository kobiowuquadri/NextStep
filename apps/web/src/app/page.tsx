import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  Accessibility,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  CircleCheck,
  CircleSlash,
  Clock3,
  Cloud,
  HeartHandshake,
  ListChecks,
  NotebookPen,
  Play,
  Route,
  ShieldCheck,
  Shuffle,
  Smartphone,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { mascotSvg, badgeSvg } from '@nextstep/illustrations';
import { Art, ButtonLink, Card, Eyebrow, IconChip, Section, SectionHead, reveal } from '@/components/ui';
import { PhoneShot } from '@/components/PhoneShot';
import { ScreenCycler } from '@/components/ScreenCycler';
import { FaqList, FAQ } from '@/components/Faq';
import { DownloadAvailability } from '@/components/DownloadAvailability';
import { SCREENS } from '@/lib/screens';
import styles from './home.module.css';

const d = (n: number) => ({ ['--d' as string]: n }) as CSSProperties;

const GALLERY = [SCREENS.today, SCREENS.plan, SCREENS.focus, SCREENS.checkin, SCREENS.journey, SCREENS.reflection];

const FLOW = [
  {
    screen: SCREENS.recoveryReasons,
    title: 'Say what changed',
    body: '“I missed a session”, “I have less time”, “A deadline changed”, “Something urgent came up” or “I need a lighter day”. Only the details that matter.',
  },
  {
    screen: SCREENS.recoveryPreview,
    title: 'See before and after',
    body: 'What stays the same, what moves, what gets split into smaller sessions, and what is now at risk — each with a plain reason.',
  },
  {
    screen: SCREENS.recoveryChoose,
    title: 'Choose',
    body: 'Accept the changes, adjust the proposal, or keep your current plan. Nothing changes until you say so, and you can undo.',
  },
  {
    screen: SCREENS.badge,
    title: 'Take the next step',
    body: 'Get one small, doable action for right now. Finish it and earn Back on Track — once, for real progress.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* 1. Hero */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.blobA} aria-hidden />
        <div className={styles.blobB} aria-hidden />
        <div className={styles.blobC} aria-hidden />
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <span className="rise" style={d(0)}>
              <Eyebrow>For students juggling study, work and life</Eyebrow>
            </span>
            <h1 id="hero-title" className={styles.heroTitle}>
              <span className={`${styles.line} rise`} style={d(1)}>
                Plans change.
              </span>
              <span className={`${styles.line} rise`} style={d(2)}>
                <span className={styles.heroAccent}>Keep moving.</span>
              </span>
            </h1>
            <p className={`${styles.heroLead} rise`} style={d(3)}>
              NextStep turns your courses, deadlines and real availability into a plan you can actually follow — and when your week falls apart,{' '}
              <strong>Recovery Mode</strong> rebuilds it around the time you really have.
            </p>
            <div className={`${styles.heroCtas} rise`} style={d(4)}>
              <ButtonLink href="/demo" size="lg">
                <Play size={20} aria-hidden /> Watch the demo
              </ButtonLink>
              <ButtonLink href="/features" variant="secondary" size="lg">
                Explore the app
              </ButtonLink>
            </div>
            <ul className={`${styles.heroFacts} rise`} style={d(5)}>
              <li>
                <Check size={16} aria-hidden /> Works offline after setup
              </li>
              <li>
                <Check size={16} aria-hidden /> Explains every change
              </li>
              <li>
                <Check size={16} aria-hidden /> Never moves a real deadline
              </li>
            </ul>
            <p className={`${styles.heroNote} rise`} style={d(6)}>
              A short narrated walkthrough of the real app. Prefer to click? <Link href="/demo/interactive">Try the interactive demo</Link>, no sign-up.
            </p>
          </div>

          <div className={`${styles.stage} rise`} style={d(2)}>
            <div className={styles.stageRing} aria-hidden />
            <ScreenCycler
              screens={[SCREENS.today, SCREENS.recoveryReasons, SCREENS.recoveryPreview, SCREENS.badge, SCREENS.focus]}
              label="Screens from the NextStep Android app"
            />
            <div className={styles.stageMascot} aria-hidden>
              <Art svg={mascotSvg({ pose: 'welcome' })} />
            </div>
            <div className={`${styles.float} ${styles.floatA}`} aria-hidden>
              <span className={styles.floatIcon} data-tone="energy">
                <Shuffle size={18} />
              </span>
              <span>
                <strong>Recovery plan ready</strong>
                <small>45-min next step · 5 sessions move</small>
              </span>
            </div>
            <div className={`${styles.float} ${styles.floatB}`} aria-hidden>
              <span className={styles.floatIcon} data-tone="reward">
                <Trophy size={18} />
              </span>
              <span>
                <strong>Back on Track</strong>
                <small>Badge unlocked</small>
              </span>
            </div>
            <div className={`${styles.float} ${styles.floatC}`} aria-hidden>
              <span className={styles.floatIcon} data-tone="calm">
                <WifiOff size={18} />
              </span>
              <span>
                <strong>Saved on this phone</strong>
                <small>Syncs when you reconnect</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Problem */}
      <Section tone="warm" labelledBy="problem-title">
        <div className={styles.problem}>
          <div>
            <SectionHead id="problem-title" eyebrow="The problem" title="Knowing what to do isn’t the hard part." />
            <blockquote className={styles.quote} {...reveal('left')}>
              <p>“I know what I should do, but my schedule keeps changing, I fall behind, and I don’t know what to prioritise next.”</p>
              <footer>— the problem NextStep is built around</footer>
            </blockquote>
          </div>
          <ul className={styles.painList}>
            <li {...reveal('right', 0)}>
              <IconChip tone="energy">
                <CalendarClock aria-hidden />
              </IconChip>
              <div>
                <h3>Your week keeps moving</h3>
                <p>Shifts change, buses are late, family needs you. A plan made on Sunday is out of date by Tuesday.</p>
              </div>
            </li>
            <li {...reveal('right', 1)}>
              <IconChip tone="calm">
                <Clock3 aria-hidden />
              </IconChip>
              <div>
                <h3>Falling behind snowballs</h3>
                <p>One missed evening becomes three. Most planners just show you more red. That makes restarting harder.</p>
              </div>
            </li>
            <li {...reveal('right', 2)}>
              <IconChip tone="primary">
                <ListChecks aria-hidden />
              </IconChip>
              <div>
                <h3>Everything feels urgent</h3>
                <p>With an assignment, a test and a reading list, it’s hard to tell what deserves the next 45 minutes.</p>
              </div>
            </li>
          </ul>
        </div>
      </Section>

      {/* 3. Real screens */}
      <Section labelledBy="screens-title">
        <SectionHead
          id="screens-title"
          eyebrow="Real screens"
          title="A calm plan, a clear next step."
          intro="Captured from the NextStep Android app — a release build running on an Android emulator with the fictional sample semester. Not mock-ups."
        />
        <div className={styles.gallery} tabIndex={0} role="region" aria-label="Screens from the NextStep Android app">
          {GALLERY.map((s, i) => (
            <div key={s.src} className={styles.galleryItem} {...reveal('up', i)}>
              <PhoneShot screen={s} caption={s.label} tilt={i % 2 ? 2 : -2} sizes="(max-width: 1200px) 240px, 16vw" />
            </div>
          ))}
        </div>
        <p className={styles.galleryNote}>
          <Link href="/features" className={styles.inlineLink}>
            See every screen <ArrowRight size={16} aria-hidden />
          </Link>
        </p>
      </Section>

      {/* 4. Recovery walkthrough */}
      <Section tone="tint" labelledBy="recovery-title" id="recovery">
        <SectionHead
          id="recovery-title"
          eyebrow="Recovery Mode"
          title="When your plans change, tap one button."
          intro="Recovery Mode is NextStep’s signature moment. It never guilt-trips you and never quietly rewrites your week — you see exactly what changes, and you decide."
        />
        <ol className={styles.flow}>
          {FLOW.map((f, i) => (
            <li key={f.title} className={styles.flowStep} {...reveal('up', i)}>
              <PhoneShot screen={f.screen} size="sm" sizes="(max-width: 1100px) 230px, 15vw" />
              <div className={styles.flowText}>
                <span className={styles.stepNum}>{i + 1}</span>
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </div>
              {i < FLOW.length - 1 && (
                <svg className={styles.connector} viewBox="0 0 64 24" aria-hidden="true">
                  <path d="M2 12 H54" />
                  <path d="M46 4 L56 12 L46 20" className={styles.arrowHead} />
                </svg>
              )}
            </li>
          ))}
        </ol>
        <div className={styles.toneBand} {...reveal('up')}>
          <p className={styles.toneLabel}>How NextStep talks</p>
          <ul>
            <li>“You still have a next step.”</li>
            <li>“Let’s make the rest of your week manageable.”</li>
            <li>“You have less time than planned. Here are your options.”</li>
          </ul>
        </div>
      </Section>

      {/* 5. Core features */}
      <Section labelledBy="features-title">
        <SectionHead id="features-title" eyebrow="Core features" title="Everything points to your next step." />
        <div className={styles.bento}>
          <Card tone="primary" className={styles.bentoHero} revealAs="up">
            <div className={styles.bentoHeroCopy}>
              <IconChip>
                <Route aria-hidden />
              </IconChip>
              <h3>A planner that explains itself</h3>
              <p>
                Deadlines, effort, dependencies, study windows, work, commute and protected rest go in. A realistic plan comes out — with a plain-language
                reason for every priority. If the work can’t fit, NextStep shows the shortfall and your options instead of an impossible plan.
              </p>
              <Link href="/how-it-works" className={styles.inlineLink}>
                How the planner decides <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
            <div className={styles.bentoPeek}>
              <PhoneShot screen={SCREENS.planTasks} size="sm" sizes="230px" />
            </div>
          </Card>
          <Card tone="energy" revealAs="up" delay={1}>
            <IconChip tone="energy">
              <Shuffle aria-hidden />
            </IconChip>
            <h3>Recovery Mode</h3>
            <p>Five common disruptions, one calm before/after review, and a smaller next action you can do today.</p>
          </Card>
          <Card revealAs="up" delay={2}>
            <IconChip tone="calm">
              <Timer aria-hidden />
            </IconChip>
            <h3>Focus sessions</h3>
            <p>An optional timer that survives app restarts, with a short check-in afterwards. Or log time manually — both count.</p>
          </Card>
          <Card tone="reward" revealAs="up" delay={1}>
            <IconChip tone="reward">
              <Trophy aria-hidden />
            </IconChip>
            <h3>A journey, not a scoreboard</h3>
            <p>XP, levels, quests and badges for meaningful progress. Earn cosmetic items for Nex, your companion.</p>
          </Card>
          <Card revealAs="up" delay={2}>
            <IconChip tone="success">
              <NotebookPen aria-hidden />
            </IconChip>
            <h3>Weekly reflection</h3>
            <p>Planned vs done, estimates vs reality, what got in the way — and a suggestion for a more realistic next week.</p>
          </Card>
          <Card tone="calm" className={styles.bentoWide} revealAs="up" delay={1}>
            <IconChip tone="calm">
              <BookOpenCheck aria-hidden />
            </IconChip>
            <h3>Resources you can take offline</h3>
            <p>
              Short practice checks with explanations, sized before you download them. Sample content is written by Team Apex and clearly marked as not
              educator-reviewed.
            </p>
          </Card>
          <Card revealAs="up" delay={2}>
            <IconChip tone="energy">
              <Target aria-hidden />
            </IconChip>
            <h3>Room for you, too</h3>
            <p>One or two personal goals — reading, exercise, a career skill — fitted around academic deadlines.</p>
          </Card>
          <Card tone="success" revealAs="up" delay={3}>
            <IconChip tone="success">
              <Accessibility aria-hidden />
            </IconChip>
            <h3>Gentle by design</h3>
            <p>Dark theme, reduced motion, quiet hours, and status that never relies on colour alone. Celebrations can be switched off.</p>
          </Card>
        </div>
      </Section>

      {/* 6. Online and offline */}
      <Section tone="warm" labelledBy="offline-title">
        <SectionHead
          id="offline-title"
          eyebrow="Online & offline"
          title="Built for patchy data — honestly."
          intro="The mobile app keeps working when your data runs out. Here is exactly what works where."
        />
        <div className={styles.offline}>
          <Card revealAs="left">
            <h3 className={styles.offlineHead}>
              <WifiOff aria-hidden /> Works offline after setup
            </h3>
            <ul className={styles.checks}>
              {[
                'Your saved tasks, plans, sessions and progress',
                'Planning and replanning — the scheduler runs on your phone',
                'Recovery Mode, including accepting a new plan',
                'Focus timer, check-ins and manual logging',
                'Resources you downloaded',
                'XP and badges (confirmed when you reconnect, never lost for syncing late)',
              ].map((t) => (
                <li key={t}>
                  <CircleCheck aria-hidden className={styles.ok} />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
          <figure className={styles.syncViz} {...reveal('scale', 1)}>
            <div className={styles.vizRow} aria-hidden>
              <span className={styles.vizNode}>
                <Smartphone />
              </span>
              <span className={styles.vizTrack}>
                <span className={styles.vizDot} />
                <span className={styles.vizDot} />
                <span className={styles.vizDot} />
              </span>
              <span className={styles.vizNode} data-tone="calm">
                <Cloud />
              </span>
            </div>
            <figcaption>Changes wait in an outbox on your phone and sync once when you reconnect — retries never create duplicates.</figcaption>
          </figure>
          <Card revealAs="right" delay={1}>
            <h3 className={styles.offlineHead}>
              <Wifi aria-hidden /> Needs a connection
            </h3>
            <ul className={styles.checks}>
              {[
                'Creating an account, signing in and the first download',
                'Syncing between devices (automatic when you reconnect, or tap Sync)',
                'Downloading new resources',
                'Optional AI suggestions, if enabled — planning never depends on them',
              ].map((t) => (
                <li key={t}>
                  <Wifi aria-hidden className={styles.net} />
                  {t}
                </li>
              ))}
            </ul>
            <p className={styles.honest}>
              <CircleSlash aria-hidden size={18} /> NextStep can’t solve device ownership or electricity access. We design for low-cost Android phones and short
              charging windows, but we don’t pretend those barriers away.
            </p>
          </Card>
        </div>
      </Section>

      {/* 7. Responsible gamification */}
      <Section labelledBy="games-title">
        <div className={styles.games}>
          <div>
            <SectionHead
              id="games-title"
              eyebrow="Responsible gamification"
              title="Fun that respects your time and rest."
              intro="Every reward follows a published rule. Here are the ones that matter most."
            />
            <ul className={styles.rules}>
              <li {...reveal('up', 0)}>
                <Sparkles aria-hidden /> XP for meaningful progress — not for opening the app or making hundreds of tiny tasks.
              </li>
              <li {...reveal('up', 1)}>
                <Timer aria-hidden /> Focus XP stops counting after 60 minutes, and breaks earn a bonus.
              </li>
              <li {...reveal('up', 2)}>
                <ShieldCheck aria-hidden /> Every award has a unique ID: re-syncing or toggling a task can’t farm XP.
              </li>
              <li {...reveal('up', 3)}>
                <HeartHandshake aria-hidden /> Weekly rhythm instead of fragile daily streaks. Missing a day never erases progress.
              </li>
              <li {...reveal('up', 4)}>
                <Trophy aria-hidden /> No leaderboards, no loot boxes, no money. Rewards are cosmetic and never lock learning or accessibility features.
              </li>
            </ul>
          </div>
          <div className={styles.badgeWall} aria-label="Example badges" role="group">
            {(
              [
                ['footprint', 'First Step'],
                ['reroute', 'Back on Track'],
                ['notebook', 'Weekly Reflection'],
                ['calendar', 'Steady Progress'],
                ['blocks', 'Small Wins'],
                ['leaf', 'Rest Respected'],
              ] as const
            ).map(([k, title], i) => (
              <figure key={k} {...reveal('pop', i)}>
                <div className={styles.badgeArt}>
                  <Art svg={badgeSvg(k)} />
                </div>
                <figcaption>{title}</figcaption>
              </figure>
            ))}
          </div>
          <div className={styles.gamesPhone} {...reveal('right', 2)}>
            <PhoneShot screen={SCREENS.badges} size="sm" tilt={3} sizes="230px" />
          </div>
        </div>
      </Section>

      {/* 8. Scenario */}
      <Section tone="ink" labelledBy="story-title">
        <SectionHead
          id="story-title"
          eyebrow="An illustrative scenario"
          title="One of Tobi’s evenings."
          intro="Tobi is fictional — a second-year student in Lagos who works shifts at a print shop and rides the bus home. This is the scenario in the demo video, and you can play it through yourself."
        />
        <ol className={styles.timeline}>
          {[
            ['Yesterday', 'Two planned sessions on the linked-list assignment don’t happen. It was a long day.'],
            ['Today, 17:45', 'On the bus, Tobi taps “My plans changed → I have less time” and enters 45 minutes for tonight.'],
            [
              '17:46',
              'NextStep proposes one 45-minute next step for tonight, moves the other sessions later in the week and explains each change. Tobi accepts.',
            ],
            ['That evening', 'Tobi finishes “Implement insert and delete”, checks in, and earns the Back on Track badge — once.'],
            ['Offline', 'Data runs out mid-week. Edits stay on the phone through restarts and sync once, without duplicates, when Tobi reconnects.'],
          ].map(([time, text], i) => (
            <li key={time} {...reveal('up', i)}>
              <span className={styles.time}>{time}</span>
              <p>{text}</p>
            </li>
          ))}
        </ol>
        <div className={styles.storyCta} {...reveal('up')}>
          <ButtonLink href="/demo/interactive" variant="energy" size="lg">
            Play Tobi’s week <ArrowRight size={20} aria-hidden />
          </ButtonLink>
        </div>
      </Section>

      {/* 9. FAQ */}
      <Section labelledBy="faq-title">
        <div className={styles.faq}>
          <div className={styles.faqAside}>
            <SectionHead id="faq-title" eyebrow="FAQ" title="Questions students ask." />
            <p className={styles.moreFaq}>
              <Link href="/faq" className={styles.inlineLink}>
                All questions <ArrowRight size={16} aria-hidden />
              </Link>
            </p>
            <div className={styles.faqMascot} aria-hidden>
              <Art svg={mascotSvg({ pose: 'thinking' })} />
            </div>
          </div>
          <div {...reveal('up', 1)}>
            <FaqList items={FAQ.slice(0, 5)} />
          </div>
        </div>
      </Section>

      {/* 10. CTA */}
      <Section tone="tint" labelledBy="cta-title">
        <div className={styles.cta} {...reveal('scale')}>
          <div className={styles.confetti} aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} style={d(i)} />
            ))}
          </div>
          <div className={styles.ctaArt}>
            <Art svg={mascotSvg({ pose: 'celebrate' })} />
          </div>
          <div className={styles.ctaCopy}>
            <h2 id="cta-title" className={styles.ctaTitle}>
              Your next step is waiting.
            </h2>
            <p className={styles.ctaText}>
              Watch the narrated walkthrough of the real app, or <Link href="/demo/interactive">try Recovery Mode yourself</Link> in your browser.
            </p>
            <div className={styles.heroCtas}>
              <ButtonLink href="/demo" size="lg">
                <Play size={20} aria-hidden /> Watch the demo
              </ButtonLink>
              <ButtonLink href="/features" variant="secondary" size="lg">
                Explore the app
              </ButtonLink>
            </div>
            <DownloadAvailability />
          </div>
          <div className={styles.ctaPhones}>
            <PhoneShot screen={SCREENS.todayDone} size="sm" tilt={-6} sizes="200px" />
            <PhoneShot screen={SCREENS.levelUp} size="sm" tilt={5} sizes="200px" />
          </div>
        </div>
      </Section>
    </>
  );
}
