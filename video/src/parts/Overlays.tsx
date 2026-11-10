import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, TEXT } from '../theme';
import { card, Icon } from './common';
import { PHONE } from './PhoneStage';

const TONES = {
  calm: { bg: C.lagoonSoft, fg: C.lagoon, icon: 'shuffle' as const },
  reward: { bg: C.marigoldSoft, fg: '#8A5A00', icon: 'sparkle' as const },
  offline: { bg: C.lagoonSoft, fg: C.lagoon, icon: 'wifiOff' as const },
};

/** A pill that pops next to the phone for part of a scene. */
export const Callout = ({ from, to, text, tone }: { from: number; to: number; text: string; tone: keyof typeof TONES | string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from - 1 || frame > to + 12) return null;
  const t = TONES[(tone in TONES ? tone : 'calm') as keyof typeof TONES];
  const iconName = /offline/i.test(text) ? 'wifiOff' : t.icon;
  const p = spring({ frame: frame - from, fps, config: { damping: 12, stiffness: 140 } });
  const out = interpolate(frame, [to, to + 12], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        left: PHONE.cx - 760,
        top: 770,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '18px 26px',
        ...card(C.surface),
        borderRadius: 24,
        transform: `scale(${p * out}) rotate(${(1 - p) * -8 - 2}deg)`,
        transformOrigin: 'right center',
        fontFamily: TEXT,
        fontWeight: 800,
        fontSize: 30,
        color: C.ink,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{ display: 'grid', placeItems: 'center', width: 54, height: 54, borderRadius: 16, background: t.bg, color: t.fg, border: `3px solid ${C.ink}` }}
      >
        <Icon name={iconName} size={30} />
      </span>
      {text}
    </div>
  );
};

/** Badge art bursting beside the phone when Back on Track unlocks. */
export const BadgeBurst = ({ delay = 6 }: { delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 9, stiffness: 120, mass: 0.9 } });
  const ray = interpolate(frame - delay, [0, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cx = PHONE.cx + 330;
  const cy = 300;
  const colors = [C.marigold, C.coral, C.lagoon, C.violet];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const r1 = 120 + ray * 60;
          const r2 = 150 + ray * 160;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * r1}
              y1={cy + Math.sin(a) * r1}
              x2={cx + Math.cos(a) * r2}
              y2={cy + Math.sin(a) * r2}
              stroke={colors[i % 4]}
              strokeWidth={10}
              strokeLinecap="round"
              opacity={1 - ray * 0.85}
            />
          );
        })}
      </svg>
      <Img
        src={staticFile('art/badge-reroute.svg')}
        style={{
          position: 'absolute',
          left: cx - 130,
          top: cy - 130,
          width: 260,
          height: 260,
          transform: `scale(${p}) rotate(${(1 - p) * -40 + Math.sin(frame / 10) * 3}deg)`,
        }}
      />
    </div>
  );
};

/** Chapter progress along the bottom-left during the app walkthrough. */
export const ChapterBar = ({ chapters, active, enter }: { chapters: string[]; active: number; enter: number }) => (
  <div style={{ position: 'absolute', left: 150, bottom: 84, display: 'flex', gap: 12, opacity: enter, transform: `translateY(${(1 - enter) * 40}px)` }}>
    {chapters.map((c, i) => {
      const done = i < active;
      const on = i === active;
      return (
        <div
          key={c}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 18px',
            borderRadius: 999,
            border: `3px solid ${on ? C.ink : `${C.ink}33`}`,
            background: on ? C.violet : done ? C.surface : 'transparent',
            color: on ? '#fff' : done ? C.ink : `${C.ink}88`,
            fontFamily: TEXT,
            fontWeight: 800,
            fontSize: 22,
            boxShadow: on ? `4px 5px 0 0 ${C.ink}` : 'none',
          }}
        >
          {done ? <Icon name="check" size={22} color={C.green} stroke={3.2} /> : <span style={{ opacity: 0.7 }}>{i + 1}</span>}
          {c}
        </div>
      );
    })}
  </div>
);
