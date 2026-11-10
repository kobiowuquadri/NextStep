import { interpolate, useCurrentFrame } from 'remotion';
import { C, TEXT } from '../theme';
import { displayText, Pill, Rise, useEnter, useExit } from './common';

/** Kinetic headline on the left while the phone plays. */
export const Headline = ({ number, eyebrow, title, sub, duration }: { number: number; eyebrow: string; title: string[]; sub: string; duration: number }) => {
  const frame = useCurrentFrame();
  const out = useExit(duration, 10);
  const underline = useEnter(14, { damping: 20 });
  return (
    <div
      style={{
        position: 'absolute',
        left: 150,
        top: 250,
        width: 860,
        opacity: out,
        transform: `translateY(${(1 - out) * -30}px)`,
      }}
    >
      <Rise delay={0} distance={30}>
        <Pill>
          <span style={{ color: C.ink, opacity: 0.55 }}>{String(number).padStart(2, '0')}</span>
          {eyebrow}
        </Pill>
      </Rise>
      <div style={{ marginTop: 26 }}>
        {title.map((line, i) => (
          <Rise key={line} delay={4 + i * 6} distance={110}>
            <span style={{ ...displayText(108), color: i === title.length - 1 ? C.violet : C.ink, position: 'relative', display: 'inline-block' }}>
              {line}
              {i === title.length - 1 && (
                <span
                  style={{
                    position: 'absolute',
                    left: 4,
                    right: 8,
                    bottom: 6,
                    height: 16,
                    borderRadius: 999,
                    background: C.marigold,
                    zIndex: -1,
                    transformOrigin: 'left',
                    transform: `scaleX(${underline})`,
                  }}
                />
              )}
            </span>
          </Rise>
        ))}
      </div>
      <Rise delay={16} distance={40}>
        <p style={{ margin: '30px 0 0', fontFamily: TEXT, fontWeight: 500, fontSize: 38, lineHeight: 1.35, color: C.inkSoft, maxWidth: 760 }}>{sub}</p>
      </Rise>
      {/* tiny progress tick so each beat feels alive */}
      <div style={{ marginTop: 34, width: 160, height: 8, borderRadius: 999, background: `${C.ink}14`, overflow: 'hidden' }}>
        <div style={{ width: `${interpolate(frame, [0, duration], [0, 100], { extrapolateRight: 'clamp' })}%`, height: '100%', background: C.coral }} />
      </div>
    </div>
  );
};
