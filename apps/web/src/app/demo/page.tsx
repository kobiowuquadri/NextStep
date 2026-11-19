import type { Metadata } from 'next';
import { Captions, Clock3, Download, MousePointerClick, Smartphone, Volume2 } from 'lucide-react';
import { mascotSvg } from '@nextstep/illustrations';
import { Art, Card, Eyebrow, Section } from '@/components/ui';
import { ApkDownload } from '@/components/ApkDownload';
import { WalkthroughPlayer } from '@/components/WalkthroughPlayer';
import walkthrough from '@/lib/walkthrough.generated.json';
import styles from './demo-video.module.css';

export const metadata: Metadata = {
  title: 'Demo & download',
  description:
    'Watch a short narrated walkthrough of the NextStep Android app, then download the Android APK. Captions, a transcript and install steps included.',
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
              <Eyebrow>Demo & download</Eyebrow>
            </span>
            <h1 id="demo-title" className={`${styles.title} rise`} style={{ ['--d' as string]: 1 }}>
              See NextStep <span className={styles.accent}>in action.</span>
            </h1>
            <p className={`${styles.lead} rise`} style={{ ['--d' as string]: 2 }}>
              A {length} walkthrough of the real Android app. A student’s plans change, Recovery Mode rebuilds the week, and one small next step gets done.
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

      <Section tone="warm" labelledBy="download-title">
        <div className={styles.split}>
          <ApkDownload id="download" />
          <Card revealAs="up" delay={1} className={styles.madeCard}>
            <h2 className={styles.h2}>How this video was made</h2>
            <ul className={styles.made}>
              <li>
                <Smartphone aria-hidden />{' '}
                <span>
                  Every app screen is a screen recording of the NextStep Android release build on an Android emulator. The footage is trimmed, not edited.
                </span>
              </li>
              <li>
                <MousePointerClick aria-hidden />{' '}
                <span>The student and the sample semester in the video are fictional. No real student data appears.</span>
              </li>
              <li>
                <Volume2 aria-hidden />{' '}
                <span>The narration is a synthetic voice generated with Kokoro, an open-source text-to-speech model. It is not a real person.</span>
              </li>
            </ul>
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
    </>
  );
}
