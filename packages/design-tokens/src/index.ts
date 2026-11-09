/**
 * NextStep design tokens.
 *
 * Raw palette values live in `palette`. Product code must use the semantic
 * tokens in `themes.light` / `themes.dark` so that meaning (success, warning,
 * danger, reward) stays consistent across mobile, web and the demo.
 */

export const palette = {
  ink: { 950: '#0B0A16', 900: '#17142E', 800: '#25213F', 700: '#363052' },
  violet: {
    50: '#F2EFFF', 100: '#E4DEFF', 200: '#CABFFF', 300: '#A898FF', 400: '#8670FF',
    500: '#6A4DFF', 600: '#5534F0', 700: '#4526C7', 800: '#36209A', 900: '#261A66',
  },
  marigold: {
    50: '#FFF8E1', 100: '#FFEDB3', 200: '#FFE07F', 300: '#FFD24D', 400: '#FFC52E',
    500: '#F5B000', 600: '#C98E00', 700: '#7A5600',
  },
  coral: {
    50: '#FFF0EC', 100: '#FFD9CF', 200: '#FFBBA8', 300: '#FF9A80', 400: '#FF7D5E',
    500: '#F2603D', 600: '#D2462A', 700: '#9E321C',
  },
  lagoon: {
    50: '#E8F8FA', 100: '#C5EEF3', 200: '#94DFE9', 300: '#5FCFDE', 400: '#2FB8CB',
    500: '#149EB3', 600: '#0E7F91', 700: '#0A5A68',
  },
  green: { 50: '#E7F7EE', 100: '#C3EBD3', 300: '#5CC98E', 500: '#1E9E5A', 600: '#15804A', 700: '#0F6239' },
  orange: { 50: '#FFF2E5', 100: '#FFDDB8', 300: '#FFAE5C', 500: '#E8780C', 600: '#C26306', 700: '#9A4B03' },
  red: { 50: '#FDECEC', 100: '#F9CDD0', 300: '#EE7C86', 500: '#DC3545', 600: '#B42332', 700: '#8A1A26' },
  sand: {
    0: '#FFFFFF', 25: '#FFFBF5', 50: '#FBF6EE', 100: '#F3EDE3', 200: '#E6DFD3', 300: '#CFC7BA',
    400: '#A39C91', 500: '#78726A', 600: '#57524C', 700: '#3B3733',
  },
  night: { 0: '#100E1F', 50: '#16132A', 100: '#1B1830', 200: '#24203D', 300: '#2E2A4B', 400: '#3D3860', 500: '#55507A' },
} as const;

export interface SemanticColors {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  surfaceSubtle: string;
  surfaceInverse: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textOnPrimary: string;
  textOnAccent: string;
  border: string;
  borderStrong: string;
  focusRing: string;
  /** Hard offset shadow used by tactile cards and buttons. */
  tactileShadow: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primarySoftText: string;
  /** Rewards, XP and celebration. Never used to mean "warning". */
  reward: string;
  rewardSoft: string;
  rewardText: string;
  /** Mascot energy, highlights, recovery entry point. */
  energy: string;
  energySoft: string;
  energyText: string;
  /** Calm, focus and information. */
  calm: string;
  calmSoft: string;
  calmText: string;
  success: string;
  successSoft: string;
  successText: string;
  warning: string;
  warningSoft: string;
  warningText: string;
  danger: string;
  dangerSoft: string;
  dangerText: string;
  overlay: string;
}

const light: SemanticColors = {
  canvas: palette.sand[25],
  surface: palette.sand[0],
  surfaceRaised: palette.sand[0],
  surfaceSubtle: palette.sand[50],
  surfaceInverse: palette.ink[900],
  textPrimary: palette.ink[900],
  textSecondary: '#4F4A5E',
  textMuted: '#686279',
  textInverse: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  textOnAccent: palette.ink[900],
  border: '#E4DEEA',
  borderStrong: palette.ink[900],
  focusRing: palette.violet[500],
  tactileShadow: palette.ink[900],
  primary: palette.violet[600],
  primaryPressed: palette.violet[700],
  primarySoft: palette.violet[50],
  primarySoftText: palette.violet[700],
  reward: palette.marigold[400],
  rewardSoft: palette.marigold[50],
  rewardText: palette.marigold[700],
  energy: palette.coral[400],
  energySoft: palette.coral[50],
  energyText: palette.coral[700],
  calm: palette.lagoon[500],
  calmSoft: palette.lagoon[50],
  calmText: palette.lagoon[700],
  success: palette.green[500],
  successSoft: palette.green[50],
  successText: palette.green[700],
  warning: palette.orange[500],
  warningSoft: palette.orange[50],
  warningText: palette.orange[700],
  danger: palette.red[500],
  dangerSoft: palette.red[50],
  dangerText: palette.red[600],
  overlay: 'rgba(23, 20, 46, 0.55)',
};

const dark: SemanticColors = {
  canvas: palette.night[0],
  surface: palette.night[100],
  surfaceRaised: palette.night[200],
  surfaceSubtle: palette.night[50],
  surfaceInverse: '#F5F3FF',
  textPrimary: '#F5F3FF',
  textSecondary: '#C9C3DE',
  textMuted: '#A39DBA',
  textInverse: palette.ink[900],
  textOnPrimary: palette.ink[950],
  textOnAccent: palette.ink[950],
  border: palette.night[300],
  borderStrong: '#8C86AE',
  focusRing: palette.violet[300],
  tactileShadow: '#05040C',
  primary: '#9C8AFF',
  primaryPressed: palette.violet[300],
  primarySoft: '#2A2452',
  primarySoftText: palette.violet[200],
  reward: palette.marigold[300],
  rewardSoft: '#3A3020',
  rewardText: palette.marigold[200],
  energy: palette.coral[300],
  energySoft: '#3C2524',
  energyText: palette.coral[200],
  calm: palette.lagoon[300],
  calmSoft: '#16343B',
  calmText: palette.lagoon[200],
  success: palette.green[300],
  successSoft: '#183626',
  successText: '#8EE0B2',
  warning: palette.orange[300],
  warningSoft: '#3D2A15',
  warningText: '#FFC48A',
  danger: palette.red[300],
  dangerSoft: '#3D1C22',
  dangerText: '#F7A5AD',
  overlay: 'rgba(5, 4, 12, 0.7)',
};

export const themes = { light, dark } as const;
export type ThemeName = keyof typeof themes;

export const fonts = {
  display: 'Bricolage Grotesque',
  body: 'Plus Jakarta Sans',
} as const;

/** Mobile type scale (points). Body text never goes below 14; captions are 12 and used sparingly for metadata. */
export const typeScale = {
  display: { size: 34, lineHeight: 40, weight: '800', family: 'display' },
  h1: { size: 28, lineHeight: 34, weight: '800', family: 'display' },
  h2: { size: 22, lineHeight: 28, weight: '700', family: 'display' },
  h3: { size: 18, lineHeight: 24, weight: '700', family: 'body' },
  body: { size: 16, lineHeight: 24, weight: '400', family: 'body' },
  bodyStrong: { size: 16, lineHeight: 24, weight: '600', family: 'body' },
  small: { size: 14, lineHeight: 20, weight: '500', family: 'body' },
  label: { size: 13, lineHeight: 18, weight: '700', family: 'body' },
  caption: { size: 12, lineHeight: 16, weight: '600', family: 'body' },
} as const;
export type TypeVariant = keyof typeof typeScale;

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const touch = { min: 48, comfortable: 56 } as const;
export const border = { hairline: 1, tactile: 2 } as const;
/** Tactile elevation: solid offset shadow, no blur. Pressed state reduces the offset. */
export const tactile = { offset: 4, pressedOffset: 1 } as const;

export const motion = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 380,
  celebrate: 900,
  easing: { standard: [0.2, 0, 0, 1], emphasized: [0.3, 0, 0, 1.15] },
} as const;

/** Course colours students can pick. Used as fills/markers with ink labels, never as the only status signal. */
export const courseColors = [
  palette.violet[400],
  palette.coral[400],
  palette.lagoon[400],
  palette.marigold[400],
  palette.green[300],
  '#F07FC0',
  '#7C93FF',
  '#A3C94A',
] as const;

export function cssVariables(theme: SemanticColors): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme)) {
    out[`--ns-${key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`] = value;
  }
  return out;
}

/** WCAG 2.x contrast ratio between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}
