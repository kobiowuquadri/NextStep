'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CircleDot, Hourglass, Waves } from 'lucide-react';
import { STATUS_META } from './shared';
import styles from './demo.module.css';

export function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'muted' as const };
  const Icon = meta.tone === 'success' ? CheckCircle2 : meta.tone === 'danger' ? AlertTriangle : meta.tone === 'warning' ? Hourglass : meta.tone === 'calm' ? Waves : CircleDot;
  return (
    <span className={`${styles.status} ${styles['status_' + meta.tone]}`}>
      <Icon size={14} aria-hidden /> {meta.label}
    </span>
  );
}

export function XpBar({ progress, label }: { progress: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className={styles.xpBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <span className={styles.xpFill} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function CourseDot({ color }: { color?: string }) {
  return <span className={styles.courseDot} style={{ background: color ?? 'var(--ns-border)' }} aria-hidden />;
}

export function Empty({ art, title, children }: { art: string; title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyArt} aria-hidden dangerouslySetInnerHTML={{ __html: art }} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
