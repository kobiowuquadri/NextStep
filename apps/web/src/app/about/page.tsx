import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { mascotSvg } from '@nextstep/illustrations';
import { Art, ButtonLink, Card, PageHero, Section, SectionHead } from '@/components/ui';
import { site } from '@/lib/site';
import styles from '../pages.module.css';

export const metadata: Metadata = {
  title: 'About Team Apex',
  description: 'NextStep is an independent student productivity project by Team Apex.',
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Built by Team Apex."
        intro="NextStep began with a simple observation: most students know what they should do. What breaks is the plan, the week after it was made. We built NextStep to make restarting easy."
        art={<Art svg={mascotSvg({ pose: 'celebrate', accessory: 'gradcap' })} />}
      />
      <Section labelledBy="principles-h">
        <SectionHead id="principles-h" eyebrow="What we believe" title="Principles behind the product." />
        <div className={styles.threeUp}>
          <Card revealAs="up" delay={0} tone="primary">
            <h3 className={styles.h3}>Plans should bend, not break</h3>
            <p>A good plan expects disruption. Recovery should take one tap and never feel like failure.</p>
          </Card>
          <Card revealAs="up" delay={1} tone="reward">
            <h3 className={styles.h3}>Honesty over optimism</h3>
            <p>If the work can’t fit, we say so and show options. We don’t move real deadlines, invent certainty or claim outcomes we haven’t measured.</p>
          </Card>
          <Card revealAs="up" delay={2} tone="calm">
            <h3 className={styles.h3}>Fun that respects rest</h3>
            <p>Rewards follow meaningful progress, breaks count, and nothing punishes a missed day.</p>
          </Card>
        </div>
      </Section>
      <Section tone="warm" labelledBy="status-h">
        <SectionHead id="status-h" eyebrow="Where we are" title="Project status." />
        <div className={styles.twoCol}>
          <Card revealAs="up" delay={0}>
            <h3 className={styles.h3}>Built</h3>
            <ul className={styles.bullets}>
              <li>Mobile app (React Native / Expo), Android first</li>
              <li>Explainable scheduler and Recovery Mode, shared by app and demo</li>
              <li>Backend API with offline sync and conflict handling</li>
              <li>This website and the browser demo</li>
            </ul>
          </Card>
          <Card revealAs="up" delay={1}>
            <h3 className={styles.h3}>Not yet</h3>
            <ul className={styles.bullets}>
              <li>Published app store releases</li>
              <li>Educator-reviewed learning content</li>
              <li>Partnerships with schools or organisations</li>
              <li>Studies of learning outcomes</li>
            </ul>
          </Card>
        </div>
        <p className={styles.note}>
          NextStep is independent. It is not endorsed by any university, scholarship programme, sponsor or hackathon organiser.
          {site.contactEmail ? (
            <>
              {' '}
              To reach the team: <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
            </>
          ) : null}
        </p>
        <div className={styles.ctaRow}>
          <ButtonLink href="/demo" size="lg">
            Try the demo <ArrowRight size={20} aria-hidden />
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
