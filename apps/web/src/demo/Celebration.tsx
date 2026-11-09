'use client';

import { useEffect, useRef } from 'react';
import { badgeSvg, mascotSvg, type BadgeKey } from '@nextstep/illustrations';
import { useDemo } from './store';
import styles from './demo.module.css';

/** Brief badge unlock. Confetti is CSS-only and disabled under reduced motion. */
export function Celebration() {
  const { celebration, levelUp, dismissCelebration, app } = useDemo();
  const ref = useRef<HTMLDialogElement>(null);
  const open = !!celebration || levelUp !== null;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={styles.celebrate} aria-labelledby="celebrate-title" onClose={dismissCelebration}>
      {open && (
        <div className={styles.celebrateInner}>
          <div className={styles.confetti} aria-hidden>
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={{ ['--i' as string]: i }} />
            ))}
          </div>
          {celebration ? (
            <>
              <div className={styles.celebrateBadge} aria-hidden dangerouslySetInnerHTML={{ __html: badgeSvg(celebration.badge as BadgeKey) }} />
              <p className={styles.kicker}>Badge unlocked</p>
              <h2 id="celebrate-title">{celebration.title}</h2>
              <p>{celebration.description}</p>
              {celebration.reward && <p className={styles.muted}>New style for Nex unlocked on the Journey tab.</p>}
            </>
          ) : (
            <>
              <div className={styles.celebrateBadge} aria-hidden dangerouslySetInnerHTML={{ __html: mascotSvg({ pose: 'celebrate', skin: app.preferences.mascotSkin, accessory: app.preferences.mascotAccessory }) }} />
              <p className={styles.kicker}>Level up</p>
              <h2 id="celebrate-title">Level {levelUp}</h2>
              <p>Every step counted.</p>
            </>
          )}
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={dismissCelebration} autoFocus>
            Keep going
          </button>
        </div>
      )}
    </dialog>
  );
}
