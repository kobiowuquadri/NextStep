'use client';

import { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import styles from './walkthrough.module.css';

export type Chapter = { label: string; start: number };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Native video with English captions on by default, plus chapter buttons that jump to each part. */
export function WalkthroughPlayer({
  src,
  poster,
  captions,
  chapters,
  width,
  height,
}: {
  src: string;
  poster: string;
  captions: string;
  chapters: Chapter[];
  width: number;
  height: number;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const active = chapters.reduce((a, c, i) => (time >= c.start - 0.05 ? i : a), 0);

  const jump = (start: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = start;
    void v.play().catch(() => undefined);
  };

  return (
    <div className={styles.player}>
      <div className={styles.frame}>
        <video
          ref={video}
          className={styles.video}
          controls
          preload="metadata"
          playsInline
          poster={poster}
          width={width}
          height={height}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          aria-label="NextStep walkthrough video with narration"
        >
          <source src={src} type="video/mp4" />
          <track kind="captions" src={captions} srcLang="en" label="English" default />
          Your browser can’t play this video. <a href={src}>Download the MP4</a> instead.
        </video>
      </div>
      <nav aria-label="Video chapters" className={styles.chaptersNav}>
        <ol className={styles.chapters}>
          {chapters.map((c, i) => (
            <li key={c.label}>
              <button type="button" className={styles.chapter} aria-current={i === active && time > 0 ? 'true' : undefined} onClick={() => jump(c.start)}>
                <span className={styles.chapterTime}>{clock(c.start)}</span>
                <span>{c.label}</span>
                <Play size={14} aria-hidden className={styles.chapterIcon} />
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
