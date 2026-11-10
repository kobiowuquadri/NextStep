import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C } from '../theme';

/** Cream canvas with slow-drifting brand shapes. */
export const Background = () => {
  const f = useCurrentFrame();
  const a = Math.sin(f / 95) * 34;
  const b = Math.cos(f / 120) * 28;
  const blob = (s: React.CSSProperties) => <div style={{ position: 'absolute', borderRadius: '50%', ...s }} />;
  return (
    <AbsoluteFill style={{ backgroundColor: C.canvas, overflow: 'hidden' }}>
      {blob({ width: 780, height: 780, left: -330 + a, top: -300 + b, background: C.marigoldSoft, border: `3px solid ${C.marigold}66` })}
      {blob({ width: 640, height: 640, right: -240 - b, bottom: -300 + a, background: C.lagoonSoft })}
      {blob({ width: 190, height: 190, left: 880 + b, top: -80 + a / 2, background: C.coralSoft })}
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
        <path
          d="M -40 980 C 240 900 300 1040 560 990 S 900 900 1040 1010"
          fill="none"
          stroke={C.coral}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="1 18"
          strokeDashoffset={-f * 0.6}
        />
      </svg>
    </AbsoluteFill>
  );
};
