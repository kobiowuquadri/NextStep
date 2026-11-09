import type { Metadata } from 'next';
import { Accessibility, BatteryLow, Contrast, Hand, Moon, Smartphone, Type, Volume2, WifiOff, Vibrate, Users, Eye } from 'lucide-react';
import { mascotSvg } from '@nextstep/illustrations';
import { Art, Card, PageHero, Section, SectionHead } from '@/components/ui';
import styles from '../pages.module.css';

export const metadata: Metadata = {
  title: 'Community & accessibility',
  description:
    'How NextStep is designed for Nigerian tertiary and distance-learning students with limited data, shared devices and busy lives — and the accessibility features it includes.',
};

export default function CommunityPage() {
  return (
    <>
      <PageHero
        eyebrow="Our approach"
        title="Designed for real constraints."
        intro="NextStep starts with Nigerian tertiary and distance-learning students who balance study with work, commuting, family duties and limited data — and is built to be useful to students anywhere."
        art={
          <Art
            svg={mascotSvg({
              pose: 'encourage',
              accessory: 'scarf',
              skin: 'lagoon',
            })}
          />
        }
      />

      <Section labelledBy="constraints-h">
        <SectionHead id="constraints-h" eyebrow="Constraints we design for" title="Data, devices and time." />
        <div className={styles.listGrid}>
          <Card revealAs="up" delay={0}>
            <h3>
              <WifiOff aria-hidden /> Limited or expensive data
            </h3>
            <p>
              Planning, Recovery Mode and the focus timer run on the phone. Sync sends only what changed since the last sync, and you can choose to sync only on
              Wi-Fi.
            </p>
          </Card>
          <Card revealAs="up" delay={1}>
            <h3>
              <Smartphone aria-hidden /> Low-cost Android phones
            </h3>
            <p>
              Android is the first target. Animations are light, art is vector-based rather than large images, and everything works with reduced motion switched
              on.
            </p>
          </Card>
          <Card revealAs="up" delay={2}>
            <h3>
              <BatteryLow aria-hidden /> Power cuts and short charging windows
            </h3>
            <p>Your work is saved to the phone immediately, so an unexpected shutdown doesn’t lose a check-in or a plan you accepted.</p>
          </Card>
          <Card revealAs="up" delay={3}>
            <h3>
              <Users aria-hidden /> Shared devices
            </h3>
            <p>Each account’s data is kept in its own local store, and logging out clears it — after warning you if anything hasn’t synced yet.</p>
          </Card>
        </div>
        <p className={styles.note}>
          <strong>What NextStep can’t do:</strong> it can’t provide a device, data or electricity, and it doesn’t replace teaching, counselling or support
          services. We have not established partnerships with schools or community organisations, and we don’t claim proven learning outcomes.
        </p>
      </Section>

      <Section tone="warm" labelledBy="a11y-h">
        <SectionHead
          id="a11y-h"
          eyebrow="Accessibility"
          title="Usable by more people, by default."
          intro="These are built in across the app, the website and the demo."
        />
        <div className={styles.listGrid}>
          <Card revealAs="up" delay={0}>
            <h3>
              <Accessibility aria-hidden /> Screen readers & keyboard
            </h3>
            <p>Every control has a label, status is announced in words, and the website and demo can be used fully with a keyboard, with visible focus.</p>
          </Card>
          <Card revealAs="up" delay={1}>
            <h3>
              <Type aria-hidden /> Readable text
            </h3>
            <p>Body text is at least 14 points and respects your phone’s text size setting. Layouts reflow rather than truncate.</p>
          </Card>
          <Card revealAs="up" delay={2}>
            <h3>
              <Contrast aria-hidden /> Contrast & colour
            </h3>
            <p>
              Colours meet WCAG AA contrast in light and dark themes (checked by automated tests). Status always uses an icon and a word, never colour alone.
            </p>
          </Card>
          <Card revealAs="up" delay={3}>
            <h3>
              <Hand aria-hidden /> Large touch targets
            </h3>
            <p>Buttons and controls are at least 48 points tall, with generous spacing for one-handed use on a bus.</p>
          </Card>
          <Card revealAs="up" delay={0}>
            <h3>
              <Eye aria-hidden /> Reduced motion
            </h3>
            <p>NextStep follows your system’s reduced-motion setting, and celebrations and animations can be turned off in settings.</p>
          </Card>
          <Card revealAs="up" delay={1}>
            <h3>
              <Moon aria-hidden /> Quiet hours
            </h3>
            <p>No reminders during the quiet hours you choose (22:00–07:00 by default).</p>
          </Card>
          <Card revealAs="up" delay={2}>
            <h3>
              <Volume2 aria-hidden /> Sound off by default
            </h3>
            <p>NextStep is silent unless you switch sounds on.</p>
          </Card>
          <Card revealAs="up" delay={3}>
            <h3>
              <Vibrate aria-hidden /> Optional haptics
            </h3>
            <p>Small vibrations confirm actions; switch them off any time.</p>
          </Card>
        </div>
      </Section>

      <Section labelledBy="community-h">
        <SectionHead
          id="community-h"
          eyebrow="Community"
          title="We want to build this with students."
          intro="NextStep has no leaderboards, public profiles or social features in this release — your plan is private. If student groups or departments want to pilot NextStep, we would like to hear from them; no such partnerships exist yet."
        />
      </Section>
    </>
  );
}
