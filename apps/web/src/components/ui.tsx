import Link from 'next/link';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import styles from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'energy' | 'ghost';

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  size = 'md',
  ...rest
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: 'md' | 'lg';
} & Omit<ComponentProps<typeof Link>, 'href'>) {
  return (
    <Link href={href} className={`${styles.btn} ${styles[variant]} ${size === 'lg' ? styles.lg : ''}`} {...rest}>
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  size?: 'md' | 'lg' | 'sm';
} & ComponentProps<'button'>) {
  return (
    <button className={`${styles.btn} ${styles[variant]} ${size === 'lg' ? styles.lg : size === 'sm' ? styles.sm : ''} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Eyebrow({ children, tone = 'energy' }: { children: ReactNode; tone?: 'energy' | 'primary' | 'calm' | 'reward' }) {
  return <span className={`${styles.eyebrow} ${styles['eyebrow_' + tone]}`}>{children}</span>;
}

/** Renders trusted, build-time SVG markup from @nextstep/illustrations. */
export function Art({ svg, className = '', label }: { svg: string; className?: string; label?: string }) {
  return (
    <div
      className={`art ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Props that opt an element into the scroll reveal (see globals.css and Motion.tsx). */
export type RevealKind = 'up' | 'scale' | 'left' | 'right' | 'pop';
export function reveal(kind: RevealKind | boolean | undefined, delay = 0): { 'data-reveal'?: string; style?: CSSProperties } {
  if (!kind) return {};
  return {
    'data-reveal': kind === true ? 'up' : kind,
    style: { ['--d' as string]: String(delay) } as CSSProperties,
  };
}

export function Section({
  children,
  tone = 'plain',
  id,
  labelledBy,
  width = 'full',
  className = '',
}: {
  children: ReactNode;
  tone?: 'plain' | 'tint' | 'ink' | 'warm';
  id?: string;
  labelledBy?: string;
  width?: 'full' | 'narrow';
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${styles.section} ${styles['section_' + tone]} ${className}`}>
      <div className={`container ${width === 'narrow' ? 'container-narrow' : ''}`}>{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  intro,
  id,
  align = 'left',
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  id?: string;
  align?: 'left' | 'center';
}) {
  return (
    <header className={`${styles.sectionHead} ${align === 'center' ? styles.center : ''}`} {...reveal('up')}>
      {eyebrow && <Eyebrow tone="primary">{eyebrow}</Eyebrow>}
      <h2 id={id} className={styles.sectionTitle}>
        {title}
        <Doodle />
      </h2>
      {intro && <p className={styles.sectionIntro}>{intro}</p>}
    </header>
  );
}

/** Hand-drawn step doodle next to headings: a dotted path ending in a forward hop. */
export function Doodle() {
  return (
    <svg className={styles.doodle} viewBox="0 0 64 32" aria-hidden="true">
      <path
        d="M2 26 C12 26 14 14 24 14 C34 14 34 24 44 22 C52 20 54 10 60 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <path d="M52 5 L61 5 L59 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Card({
  children,
  tone = 'surface',
  className = '',
  as: Tag = 'div',
  revealAs,
  delay = 0,
}: {
  children: ReactNode;
  tone?: 'surface' | 'primary' | 'reward' | 'energy' | 'calm' | 'success' | 'danger' | 'ink';
  className?: string;
  as?: 'div' | 'article' | 'li';
  revealAs?: RevealKind | boolean;
  delay?: number;
}) {
  return (
    <Tag className={`${styles.card} ${styles['card_' + tone]} ${className}`} {...reveal(revealAs, delay)}>
      {children}
    </Tag>
  );
}

export function PageHero({ eyebrow, title, intro, art }: { eyebrow: string; title: ReactNode; intro: ReactNode; art?: ReactNode }) {
  return (
    <section className={styles.pageHero}>
      <div className={`container ${styles.pageHeroInner}`}>
        <div>
          <span className="rise" style={{ ['--d' as string]: 0, display: 'inline-block' }}>
            <Eyebrow>{eyebrow}</Eyebrow>
          </span>
          <h1 className={`${styles.pageTitle} rise`} style={{ ['--d' as string]: 1 }}>
            {title}
          </h1>
          <p className={`${styles.pageIntro} rise`} style={{ ['--d' as string]: 2 }}>
            {intro}
          </p>
        </div>
        {art && (
          <div className={`${styles.pageHeroArt} rise`} style={{ ['--d' as string]: 2 }}>
            <div className={styles.floaty}>{art}</div>
          </div>
        )}
      </div>
    </section>
  );
}

export function IconChip({ children, tone = 'primary' }: { children: ReactNode; tone?: 'primary' | 'reward' | 'energy' | 'calm' | 'success' }) {
  return <span className={`${styles.chip} ${styles['chip_' + tone]}`}>{children}</span>;
}
