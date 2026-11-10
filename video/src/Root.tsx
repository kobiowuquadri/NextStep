import { Composition } from 'remotion';
import timeline from './timeline.generated.json';
import { Walkthrough } from './Walkthrough';

export const RemotionRoot = () => (
  <Composition id="NextStepWalkthrough" component={Walkthrough} durationInFrames={timeline.totalFrames} fps={timeline.fps} width={1920} height={1080} />
);
