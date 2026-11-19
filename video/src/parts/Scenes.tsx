import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, DISPLAY, TEXT } from '../theme';
import { card, displayText, Icon, Pill, Rise, useEnter, useExit } from './common';

const Wordmark = ({ size, delay }: { size: number; delay: number }) => (
  <div style={{ display: 'flex' }}>
    {'NextStep'.split('').map((ch, i) => (
      <Rise key={i} delay={delay + i * 2} distance={size * 0.9}>
        <span style={{ ...displayText(size), letterSpacing: '-0.04em' }}>{ch}</span>
      </Rise>
    ))}
  </div>
);

const Tagline = ({ delay, size }: { delay: number; size: number }) => {
  const u = useEnter(delay + 14, { damping: 22 });
  return (
    <div style={{ display: 'flex', gap: size * 0.3, alignItems: 'baseline' }}>
      <Rise delay={delay} distance={70}>
        <span style={{ ...displayText(size) }}>Plans change.</span>
      </Rise>
      <Rise delay={delay + 6} distance={70}>
        <span style={{ ...displayText(size), color: C.violet, position: 'relative', display: 'inline-block' }}>
          Keep moving.
          <span
            style={{
              position: 'absolute',
              left: 4,
              right: 10,
              bottom: 4,
              height: size * 0.16,
              borderRadius: 999,
              background: C.marigold,
              zIndex: -1,
              transformOrigin: 'left',
              transform: `scaleX(${u})`,
            }}
          />
        </span>
      </Rise>
    </div>
  );
};

/** Floating confetti pieces (deterministic). */
const Confetti = ({ count = 22, seed = 1 }: { count?: number; seed?: number }) => {
  const f = useCurrentFrame();
  const colors = [C.marigold, C.coral, C.lagoon, C.violet];
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const r = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
        const x = (r - Math.floor(r)) * 1920;
        const speed = 2.2 + ((i * 7) % 5) * 0.5;
        const y = ((f * speed + i * 97) % 1250) - 120;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.sin((f + i * 20) / 18) * 26,
              top: y,
              width: i % 3 === 0 ? 18 : 14,
              height: i % 3 === 0 ? 18 : 24,
              borderRadius: i % 3 === 0 ? '50%' : 5,
              background: colors[i % 4],
              border: `2.5px solid ${C.ink}`,
              transform: `rotate(${f * (3 + (i % 4)) + i * 30}deg)`,
            }}
          />
        );
      })}
    </>
  );
};

export const Intro = ({ duration }: { duration: number }) => {
  const logo = useEnter(0, { damping: 11, stiffness: 140 });
  const mascot = useEnter(26, { damping: 10, stiffness: 100 });
  const out = useExit(duration, 14);
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${1 + (1 - out) * 0.06})` }}>
      <div style={{ position: 'absolute', left: 190, top: 250 }}>
        <Img src={staticFile('art/logo.svg')} style={{ width: 150, height: 150, transform: `scale(${logo}) rotate(${(1 - logo) * -90}deg)` }} />
        <div style={{ marginTop: 24 }}>
          <Wordmark size={190} delay={8} />
        </div>
        <div style={{ marginTop: 18 }}>
          <Tagline delay={30} size={84} />
        </div>
        <Rise delay={58} distance={30}>
          <p style={{ margin: '36px 0 0', fontFamily: TEXT, fontWeight: 700, fontSize: 32, color: C.inkSoft }}>
            A walkthrough of the real Android app, using a fictional sample semester.
          </p>
        </Rise>
      </div>
      <Img
        src={staticFile('art/mascot-welcome.svg')}
        style={{
          position: 'absolute',
          right: 150,
          top: 230 + Math.sin(f / 14) * 10,
          width: 520,
          transform: `translateX(${(1 - mascot) * 600}px) rotate(${(1 - mascot) * 20}deg)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Tobi = ({ duration }: { duration: number }) => {
  const enter = useEnter(0, { damping: 14 });
  const out = useExit(duration, 12);
  const facts: { icon: 'briefcase' | 'bus' | 'book' | 'target'; text: string; bg: string; fg: string }[] = [
    { icon: 'briefcase', text: 'Shifts at a print shop', bg: C.coralSoft, fg: C.coral },
    { icon: 'bus', text: 'The bus home after work', bg: C.lagoonSoft, fg: C.lagoon },
    { icon: 'book', text: 'CSC 205 · MTH 211 · GST 222', bg: C.violetSoft, fg: C.violet },
    { icon: 'target', text: 'A personal reading goal', bg: C.marigoldSoft, fg: '#8A5A00' },
  ];
  return (
    <AbsoluteFill style={{ opacity: out, transform: `translateY(${(1 - out) * -30}px)` }}>
      {/* Student card */}
      <div
        style={{
          position: 'absolute',
          left: 190,
          top: 250,
          width: 640,
          padding: '48px 52px',
          ...card(C.surface),
          borderRadius: 40,
          transform: `translateY(${(1 - enter) * 500}px) rotate(${-3 + (1 - enter) * -10}deg)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: '50%',
              background: C.marigold,
              border: `4px solid ${C.ink}`,
              display: 'grid',
              placeItems: 'center',
              ...displayText(84),
            }}
          >
            T
          </div>
          <div>
            <div style={{ ...displayText(110) }}>Tobi</div>
            <div style={{ fontFamily: TEXT, fontWeight: 700, fontSize: 30, color: C.inkSoft, marginTop: 6 }}>Second-year student</div>
          </div>
        </div>
        <div style={{ marginTop: 36 }}>
          <Pill bg={C.coralSoft} color="#B43A1E" style={{ fontSize: 22 }}>
            Fictional · sample data
          </Pill>
        </div>
      </div>
      {/* Facts */}
      <div style={{ position: 'absolute', left: 960, top: 210 }}>
        <Rise delay={6} distance={70}>
          <span style={{ ...displayText(104) }}>Meet Tobi.</span>
        </Rise>
        <div style={{ marginTop: 36, display: 'grid', gap: 22 }}>
          {facts.map((fact, i) => (
            <Rise key={fact.text} delay={22 + i * 18} distance={50}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '18px 26px', ...card(C.surface), borderRadius: 24, width: 'fit-content' }}>
                <span
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 60,
                    height: 60,
                    borderRadius: 18,
                    background: fact.bg,
                    color: fact.fg,
                    border: `3px solid ${C.ink}`,
                  }}
                >
                  <Icon name={fact.icon} size={32} />
                </span>
                <span style={{ fontFamily: TEXT, fontWeight: 800, fontSize: 36, color: C.ink }}>{fact.text}</span>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Outro = ({ duration }: { duration: number }) => {
  const logo = useEnter(0, { damping: 11, stiffness: 140 });
  const mascot = useEnter(10, { damping: 9, stiffness: 110 });
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(f, [duration - 18, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>
      <Confetti count={26} seed={3} />
      <div style={{ position: 'absolute', left: 190, top: 230 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <Img src={staticFile('art/logo.svg')} style={{ width: 150, height: 150, transform: `scale(${logo}) rotate(${(1 - logo) * 90}deg)` }} />
          <Wordmark size={170} delay={4} />
        </div>
        <div style={{ marginTop: 26 }}>
          <Tagline delay={20} size={92} />
        </div>
        <div style={{ marginTop: 50, display: 'flex', gap: 16 }}>
          {['Built by Team Apex', 'Tobi is fictional', 'Not in app stores yet'].map((t, i) => (
            <Rise key={t} delay={44 + i * 6} distance={30}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '12px 22px',
                  borderRadius: 999,
                  border: `3px solid ${C.ink}`,
                  background: C.surface,
                  fontFamily: TEXT,
                  fontWeight: 800,
                  fontSize: 26,
                  color: C.ink,
                }}
              >
                {t}
              </span>
            </Rise>
          ))}
        </div>
      </div>
      <Img
        src={staticFile('art/mascot-celebrate.svg')}
        style={{
          position: 'absolute',
          right: 90,
          top: 280 - Math.abs(Math.sin(f / 9)) * 40,
          width: 420,
          transform: `scale(${mascot})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 190,
          bottom: 70,
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 26,
          color: C.inkSoft,
          opacity: interpolate(f, [60, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}
      >
        Narration: synthetic voice
      </div>
    </AbsoluteFill>
  );
};
