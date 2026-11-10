import type { CSSProperties, ReactNode } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, DISPLAY, TEXT } from '../theme';

/** 0→1 spring that starts `delay` frames into the current Sequence. */
export function useEnter(delay = 0, config: { damping?: number; mass?: number; stiffness?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 15, mass: 0.8, stiffness: 120, ...config } });
}

/** 1 while the Sequence plays, easing to 0 over its last `frames` frames. */
export function useExit(duration: number, frames = 12) {
  const frame = useCurrentFrame();
  return interpolate(frame, [duration - frames, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** Lines that rise into place one after another. */
export function RiseLines({
  lines,
  delay = 0,
  step = 6,
  style,
  lineStyle,
}: {
  lines: ReactNode[];
  delay?: number;
  step?: number;
  style?: CSSProperties;
  lineStyle?: (i: number) => CSSProperties;
}) {
  return (
    <div style={style}>
      {lines.map((l, i) => (
        <Rise key={i} delay={delay + i * step} style={lineStyle?.(i)}>
          {l}
        </Rise>
      ))}
    </div>
  );
}

export function Rise({ children, delay = 0, distance = 60, style }: { children: ReactNode; delay?: number; distance?: number; style?: CSSProperties }) {
  const p = useEnter(delay);
  return (
    <div style={{ overflow: 'hidden', paddingBottom: '0.08em' }}>
      <div style={{ transform: `translateY(${(1 - p) * distance}px)`, opacity: Math.min(1, p * 1.4), ...style }}>{children}</div>
    </div>
  );
}

export function Pill({ children, bg = C.violetSoft, color = C.violet, style }: { children: ReactNode; bg?: string; color?: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 22px',
        borderRadius: 999,
        background: bg,
        color,
        fontFamily: TEXT,
        fontWeight: 800,
        fontSize: 24,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Tactile card: ink border with a solid offset shadow, like the app. */
export const card = (bg: string = C.surface): CSSProperties => ({
  background: bg,
  border: `3px solid ${C.ink}`,
  borderRadius: 28,
  boxShadow: `8px 10px 0 0 ${C.ink}`,
});

export const displayText = (size: number): CSSProperties => ({
  fontFamily: DISPLAY,
  fontWeight: 800,
  fontSize: size,
  lineHeight: 1.02,
  letterSpacing: '-0.035em',
  color: C.ink,
});

/** Icons drawn with Lucide-style paths (ISC licence), stroked in currentColor. */
const ICONS: Record<string, ReactNode> = {
  briefcase: (
    <>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </>
  ),
  bus: (
    <>
      <path d="M8 6v6M15 6v6M2 12h19.6" />
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
      <circle cx="7" cy="18" r="2" />
      <path d="M9 18h5" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
  book: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  wifiOff: (
    <>
      <path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 5.17-2.69M19 12.86a10 10 0 0 0-2-1.52M2 8.82a15 15 0 0 1 4.18-2.64M22 8.82a15 15 0 0 0-11.29-3.76M2 2l20 20" />
    </>
  ),
  shuffle: (
    <>
      <path d="m18 14 4 4-4 4M18 2l4 4-4 4" />
      <path d="M2 18h1.97a4 4 0 0 0 3.3-1.7l5.45-8.6a4 4 0 0 1 3.3-1.7H22M2 6h1.97a4 4 0 0 1 3.6 2.2M22 18h-6.04a4 4 0 0 1-3.3-1.8l-.36-.45" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  sparkle: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />,
};

export function Icon({ name, size = 32, color = 'currentColor', stroke = 2.4 }: { name: keyof typeof ICONS; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}
