import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import type { AppScreen } from '@/lib/screens';
import styles from './phone.module.css';

/** A simple device frame. The screen inside is always a real capture (see src/lib/screens.ts). */
export function PhoneFrame({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`${styles.frame} ${className}`} style={style}>
      <span className={styles.camera} aria-hidden />
      <div className={styles.screen}>{children}</div>
    </div>
  );
}

export function PhoneShot({
  screen,
  caption,
  tilt = 0,
  size = 'md',
  priority = false,
  sizes = '(max-width: 700px) 66vw, 300px',
  className = '',
}: {
  screen: AppScreen;
  caption?: ReactNode;
  tilt?: number;
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <figure className={`${styles.figure} ${styles[size]} ${className}`} style={{ ['--tilt' as string]: `${tilt}deg` }}>
      <PhoneFrame>
        <Image src={screen.src} alt={screen.alt} width={720} height={1600} className={styles.img} sizes={sizes} priority={priority} />
      </PhoneFrame>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}
