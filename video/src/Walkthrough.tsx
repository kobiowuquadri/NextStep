import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import timeline from './timeline.generated.json';
import { Background } from './parts/Background';
import { Headline } from './parts/Headline';
import { BadgeBurst, Callout, ChapterBar } from './parts/Overlays';
import { PhoneStage } from './parts/PhoneStage';
import { Intro, Outro, Tobi } from './parts/Scenes';
import { loadFonts } from './theme';

loadFonts();

type Scene = (typeof timeline.scenes)[number] & {
  eyebrow?: string;
  title?: string[];
  sub?: string;
  chapter?: number;
  badge?: boolean;
};

const scenes = timeline.scenes as Scene[];
const phoneScenes = scenes.filter((s) => s.kind === 'phone');
const phoneStart = phoneScenes[0].start;
const phoneEnd = phoneScenes[phoneScenes.length - 1].start + phoneScenes[phoneScenes.length - 1].frames;

const Chapters = () => {
  const frame = useCurrentFrame() + phoneStart;
  const current = [...phoneScenes].reverse().find((s) => frame >= s.start) ?? phoneScenes[0];
  const local = frame - phoneStart;
  const enter = interpolate(local, [10, 30, phoneEnd - phoneStart - 20, phoneEnd - phoneStart], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <ChapterBar chapters={timeline.chapters} active={current.chapter ?? 0} enter={enter} />;
};

export const Walkthrough = () => (
  <AbsoluteFill>
    <Background />

    {scenes.map((s) => {
      if (s.kind === 'intro')
        return (
          <Sequence key={s.id} from={s.start} durationInFrames={s.frames}>
            <Intro duration={s.frames} />
          </Sequence>
        );
      if (s.kind === 'tobi')
        return (
          <Sequence key={s.id} from={s.start} durationInFrames={s.frames}>
            <Tobi duration={s.frames} />
          </Sequence>
        );
      if (s.kind === 'outro')
        return (
          <Sequence key={s.id} from={s.start} durationInFrames={s.frames}>
            <Outro duration={s.frames} />
          </Sequence>
        );
      return null;
    })}

    <Sequence from={phoneStart} durationInFrames={phoneEnd - phoneStart}>
      <PhoneStage clips={phoneScenes.flatMap((s) => s.clips)} total={phoneEnd - phoneStart} />
      <Chapters />
    </Sequence>

    {phoneScenes.map((s, i) => (
      <Sequence key={s.id} from={s.start} durationInFrames={s.frames}>
        <Headline number={i + 1} eyebrow={s.eyebrow ?? ''} title={s.title ?? []} sub={s.sub ?? ''} duration={s.frames} />
        {s.callouts.map((c) => (
          <Callout key={c.text} from={c.from} to={c.to} text={c.text} tone={c.tone} />
        ))}
        {s.badge && <BadgeBurst delay={30} />}
      </Sequence>
    ))}

    {scenes.flatMap((s) =>
      s.voice.map((v) => (
        <Sequence key={v.id} from={s.start + v.from} durationInFrames={v.frames}>
          <Audio src={staticFile(v.file)} />
        </Sequence>
      )),
    )}
  </AbsoluteFill>
);
