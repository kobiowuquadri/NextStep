import type { Metadata } from 'next';
import { ArrowRight, Captions, Clock3, Download, MousePointerClick, Smartphone, Volume2 } from 'lucide-react';
import { mascotSvg } from '@nextstep/illustrations';
import { Art, ButtonLink, Card, Eyebrow, Section, reveal } from '@/components/ui';
import { DownloadAvailability } from '@/components/DownloadAvailability';
import { WalkthroughPlayer } from '@/components/WalkthroughPlayer';
import walkthrough from '@/lib/walkthrough.generated.json';
import styles from './demo-video.module.css';

export const metadata: Metadata = {
  title: 'Demo',
  description:
    'Watch a short walkthrough of the NextStep Android app: plans change, Recovery Mode rebuilds the week, and one small next step gets done. Captions and a transcript included.',
  robots: { index: true, follow: true },
};

const VIDEO = '/video/nextstep-walkthrough.mp4';
const minutes = Math.floor(walkthrough.duration / 60);
const secs = Math.floor(walkthrough.duration % 60); // matches the player's own clock
const length = `${minutes} min ${secs} s`;
const size = `${(walkthrough.bytes / 1_000_000).toFixed(1)} MB`;

export default function DemoVideoPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="demo-title">
        <div className={styles.blob} aria-hidden />
        <div className="container">
          <div className={styles.head}>
            <span className="rise" style={{ ['--d' as string]: 0, display: 'inline-block' }}>
              <Eyebrow>Demo</Eyebrow>
            </span>
            <h1 id="demo-title" className={`${styles.title} rise`} style={{ ['--d' as string]: 1 }}>
              See NextStep <span className={styles.accent}>in action.</span>
            </h1>
            <p className={`${styles.lead} rise`} style={{ ['--d' as string]: 2 }}>
              A {length} walkthrough of the real Android app. Tobi’s plans change, Recovery Mode rebuilds the week, and one small next step gets done.
            </p>
          </div>
          <div className={`${styles.stage} rise`} style={{ ['--d' as string]: 3 }}>
            <div className={styles.mascot} aria-hidden>
              <Art svg={mascotSvg({ pose: 'welcome' })} />
            </div>
            <WalkthroughPlayer
              src={VIDEO}
              poster="/video/nextstep-walkthrough-poster.jpg"
              captions="/video/nextstep-walkthrough.en.vtt"
              chapters={walkthrough.chapters}
              width={walkthrough.width}
              height={walkthrough.height}
            />
          </div>
          <ul className={styles.facts} aria-label="About this video">
            <li>
              <Clock3 aria-hidden size={18} /> {length}
            </li>
            <li>
              <Captions aria-hidden size={18} /> English captions, on by default
            </li>
            <li>
              <Volume2 aria-hidden size={18} /> Narrated by a synthetic voice
            </li>
            <li>
              <Download aria-hidden size={18} /> {size} MP4, loads only when you press play
            </li>
          </ul>
        </div>
      </section>

      <Section tone="warm" labelledBy="made-h">
        <div className={styles.split}>
          <Card revealAs="up" className={styles.madeCard}>
            <h2 id="made-h" className={styles.h2}>
              How this video was made
            </h2>
            <ul className={styles.made}>
              <li>
                <Smartphone aria-hidden />{' '}
                <span>
                  Every app screen is a screen recording of the NextStep Android release build on an Android emulator. The footage is trimmed, not edited.
                </span>
              </li>
              <li>
                <MousePointerClick aria-hidden /> <span>Tobi and the sample semester are fictional. No real student data appears.</span>
              </li>
              <li>
                <Volume2 aria-hidden />{' '}
                <span>The narration is a synthetic voice generated with Kokoro, an open-source text-to-speech model. It is not a real person.</span>
              </li>
            </ul>
          </Card>
          <Card revealAs="up" delay={1} className={styles.transcriptCard}>
            <details className={styles.transcript}>
              <summary>Read the transcript</summary>
              <div>
                {walkthrough.transcript.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </details>
          </Card>
        </div>
      </Section>

      <Section labelledBy="try-h">
        <div className={styles.try} {...reveal('scale')}>
          <div className={styles.tryArt} aria-hidden>
            <Art svg={mascotSvg({ pose: 'encourage' })} />
          </div>
          <div>
            <h2 id="try-h" className={styles.h2}>
              Prefer to click through it yourself?
            </h2>
            <p className={styles.tryText}>
              The interactive demo runs in your browser with the same fictional student. Your changes stay in your browser, and you can reset at any time.
            </p>
            <div className={styles.tryCtas}>
              <ButtonLink href="/demo/interactive" size="lg">
                Try the interactive demo <ArrowRight size={20} aria-hidden />
              </ButtonLink>
              <ButtonLink href="/features" variant="secondary" size="lg">
                Explore the app
              </ButtonLink>
            </div>
            <DownloadAvailability />
          </div>
        </div>
      </Section>
    </>
  );
}
