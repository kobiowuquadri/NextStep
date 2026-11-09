'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { AppScreen } from '@/lib/screens';
import { PhoneFrame } from './PhoneShot';
import phone from './phone.module.css';
import styles from './cycler.module.css';

/**
 * Crossfades through real app screens. Pauses on hover/focus, has a visible
 * pause button (WCAG 2.2.2), and starts paused for reduced-motion users.
 */
export function ScreenCycler({ screens, interval = 4200, label = 'NextStep app screens' }: { screens: AppScreen[]; interval?: number; label?: string }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
  }, []);

  // Only the current and the next screen are loaded; the rest load as the show reaches them.
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([0, 1]));
  useEffect(() => {
    setMounted((m) => (m.has(active) && m.has((active + 1) % screens.length) ? m : new Set([...m, active, (active + 1) % screens.length])));
  }, [active, screens.length]);

  const running = playing && !held;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setActive((n) => (n + 1) % screens.length), interval);
    return () => window.clearTimeout(id);
  }, [active, running, interval, screens.length]);

  return (
    <div
      className={styles.cycler}
      role="group"
      aria-roledescription="slideshow"
      aria-label={label}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
      style={{ ['--interval' as string]: `${interval}ms` }}
    >
      <PhoneFrame className={`${phone.lg} ${styles.phone}`}>
        {screens.map(
          (s, n) =>
            (mounted.has(n) || n === active) && (
              <Image
                key={s.src}
                src={s.src}
                alt={n === active ? s.alt : ''}
                aria-hidden={n === active ? undefined : true}
                width={720}
                height={1600}
                priority={n === 0}
                sizes="(max-width: 700px) 70vw, 340px"
                className={`${styles.layer} ${n === active ? styles.on : ''}`}
              />
            ),
        )}
      </PhoneFrame>
      <div className={styles.controls}>
        <ul className={styles.tabs}>
          {screens.map((s, n) => (
            <li key={s.src}>
              <button
                type="button"
                className={styles.tab}
                aria-pressed={n === active}
                onClick={() => {
                  setActive(n);
                  setPlaying(false);
                }}
              >
                {s.label}
                {n === active && running && <span key={active} className={styles.progress} aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.toggle} onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}>
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
