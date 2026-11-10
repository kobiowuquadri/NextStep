import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { C } from '../theme';

export const PHONE = { cx: 1350, screenW: 396, screenH: 880, pad: 14 };

/** The real app footage inside a phone frame, cut segment by segment. */
export const PhoneStage = ({ clips, total }: { clips: { name: string; frames: number }[]; total: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14, mass: 0.9, stiffness: 110 } });
  const exit = interpolate(frame, [total - 20, total], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const outerW = PHONE.screenW + PHONE.pad * 2;
  const outerH = PHONE.screenH + PHONE.pad * 2;
  const top = (1080 - outerH) / 2 - 18;
  const float = Math.sin(frame / 38) * 6;
  const tilt = interpolate(enter, [0, 1], [9, -1.5]) + exit * -6;

  let at = 0;
  const cuts = clips.map((c) => {
    const from = at;
    at += c.frames;
    return { ...c, from };
  });

  return (
    <AbsoluteFill>
      {/* Halo behind the phone */}
      <div
        style={{
          position: 'absolute',
          left: PHONE.cx - 430,
          top: 540 - 430 - 18,
          width: 860,
          height: 860,
          borderRadius: '50%',
          background: C.violetSoft,
          transform: `scale(${0.6 + enter * 0.4 - exit * 0.3})`,
          opacity: enter * (1 - exit),
        }}
      />
      <svg
        width={960}
        height={960}
        style={{ position: 'absolute', left: PHONE.cx - 480, top: 540 - 480 - 18, opacity: enter * (1 - exit), transform: `rotate(${frame * 0.15}deg)` }}
      >
        <circle cx={480} cy={480} r={470} fill="none" stroke={C.violet} strokeOpacity={0.35} strokeWidth={4} strokeDasharray="4 22" strokeLinecap="round" />
        <circle cx={480} cy={18} r={14} fill={C.marigold} stroke={C.ink} strokeWidth={3} />
        <circle cx={18} cy={560} r={10} fill={C.coral} stroke={C.ink} strokeWidth={3} />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: PHONE.cx - outerW / 2,
          top,
          width: outerW,
          height: outerH,
          borderRadius: 60,
          background: C.ink,
          padding: PHONE.pad,
          boxShadow: `14px 16px 0 0 ${C.ink}33, 0 30px 60px ${C.ink}22`,
          transform: `translateY(${(1 - enter) * 900 + float - exit * 120}px) rotate(${tilt}deg) scale(${1 - exit * 0.15})`,
          opacity: 1 - exit,
        }}
      >
        <div style={{ position: 'relative', width: PHONE.screenW, height: PHONE.screenH, borderRadius: 46, overflow: 'hidden', background: C.canvas }}>
          {cuts.map((c) => (
            <Sequence key={c.name} from={c.from} durationInFrames={c.frames} layout="none">
              <OffthreadVideo src={staticFile(`clips/${c.name}.mp4`)} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            </Sequence>
          ))}
          {/* Soft flash on each cut so jumps between screens read as transitions */}
          {cuts.slice(1).map((c) => {
            const o = interpolate(frame, [c.from, c.from + 7], [0.55, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return frame >= c.from && frame < c.from + 7 ? (
              <div key={`f-${c.name}`} style={{ position: 'absolute', inset: 0, background: '#fff', opacity: o }} />
            ) : null;
          })}
        </div>
        <div
          style={{
            position: 'absolute',
            top: PHONE.pad + 14,
            left: '50%',
            width: 12,
            height: 12,
            marginLeft: -6,
            borderRadius: '50%',
            background: '#07060f',
            boxShadow: '0 0 0 3px #2b2747',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
