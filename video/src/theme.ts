import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';

/** NextStep brand colours (from packages/design-tokens). */
export const C = {
  canvas: '#FFFBF5',
  surface: '#FFFFFF',
  ink: '#17142E',
  inkSoft: '#4F4A5E',
  violet: '#5534F0',
  violetSoft: '#F2EFFF',
  marigold: '#FFC52E',
  marigoldSoft: '#FFF8E1',
  coral: '#FF7D5E',
  coralSoft: '#FFF0EC',
  lagoon: '#149EB3',
  lagoonSoft: '#E8F8FA',
  green: '#1E9E5A',
} as const;

export const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif";
export const TEXT = "'Plus Jakarta Sans', system-ui, sans-serif";

const FONTS: [string, string, string][] = [
  ['Bricolage Grotesque', 'fonts/BricolageGrotesque_800ExtraBold.ttf', '800'],
  ['Bricolage Grotesque', 'fonts/BricolageGrotesque_700Bold.ttf', '700'],
  ['Plus Jakarta Sans', 'fonts/PlusJakartaSans_500Medium.ttf', '500'],
  ['Plus Jakarta Sans', 'fonts/PlusJakartaSans_700Bold.ttf', '700'],
  ['Plus Jakarta Sans', 'fonts/PlusJakartaSans_800ExtraBold.ttf', '800'],
];

let started = false;
/** Blocks rendering until the brand fonts are loaded; fails the render if they can't be. */
export function loadFonts() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('Loading brand fonts');
  Promise.all(FONTS.map(([family, file, weight]) => new FontFace(family, `url(${staticFile(file)})`, { weight }).load().then((f) => document.fonts.add(f))))
    .then(() => continueRender(handle))
    .catch((e) => cancelRender(e));
}
