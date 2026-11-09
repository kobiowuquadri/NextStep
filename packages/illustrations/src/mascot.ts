/**
 * Nex — the NextStep companion. An original, code-drawn character: a pebble
 * that is always mid-stride, with a forward-pointing leaf tuft ("the next
 * step") and chunky sneakers. All art is plain SVG attributes (no CSS, no
 * filters) so it renders identically in browsers and react-native-svg.
 */

export const INK = '#17142E';

export type MascotPose = 'welcome' | 'focus' | 'encourage' | 'recovery' | 'celebrate' | 'rest' | 'thinking';
export type MascotSkinName = 'violet' | 'lagoon' | 'coral' | 'marigold' | 'midnight' | 'mint';
export type MascotAccessoryName = 'none' | 'headphones' | 'cap' | 'scarf' | 'glasses' | 'backpack' | 'gradcap' | 'starpin';

export const SKINS: Record<MascotSkinName, { body: string; shade: string; light: string; label: string }> = {
  violet: { body: '#6A4DFF', shade: '#4526C7', light: '#A898FF', label: 'Violet' },
  lagoon: { body: '#2FB8CB', shade: '#0E7F91', light: '#94DFE9', label: 'Lagoon' },
  coral: { body: '#FF7D5E', shade: '#D2462A', light: '#FFBBA8', label: 'Coral' },
  marigold: { body: '#FFC52E', shade: '#C98E00', light: '#FFE07F', label: 'Marigold' },
  midnight: { body: '#36309A', shade: '#1F1A5C', light: '#7C74E0', label: 'Midnight' },
  mint: { body: '#5CC98E', shade: '#15804A', light: '#C3EBD3', label: 'Mint' },
};

export const ACCESSORY_LABELS: Record<MascotAccessoryName, string> = {
  none: 'None',
  headphones: 'Headphones',
  cap: 'Cap',
  scarf: 'Scarf',
  glasses: 'Glasses',
  backpack: 'Backpack',
  gradcap: 'Grad cap',
  starpin: 'Star pin',
};

const CORAL = '#FF7D5E';
const MARIGOLD = '#FFC52E';
const LAGOON = '#2FB8CB';
const VIOLET = '#6A4DFF';

export interface MascotOptions {
  pose?: MascotPose;
  skin?: MascotSkinName;
  accessory?: MascotAccessoryName;
  /** Accessible title. Omit for decorative use (adds aria-hidden). */
  title?: string;
  /** Include the ground shadow. */
  shadow?: boolean;
}

/** An outlined limb: ink stroke underneath, body colour on top. */
const limb = (d: string, color: string, w = 8) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 7}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

const sparkle = (x: number, y: number, r: number, color: string) =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${color}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;

function eyes(pose: MascotPose): string {
  const white = (cx: number) => `<ellipse cx="${cx}" cy="104" rx="13" ry="15" fill="#FFFFFF" stroke="${INK}" stroke-width="3.5"/>`;
  if (pose === 'celebrate') {
    return `<path d="M66 108 Q78 92 90 108" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><path d="M110 108 Q122 92 134 108" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  }
  if (pose === 'rest') {
    return `<path d="M67 104 Q78 113 89 104" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><path d="M111 104 Q122 113 133 104" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
  }
  const gaze: Record<MascotPose, [number, number]> = {
    welcome: [1, 0],
    focus: [0, 4],
    encourage: [1, -1],
    recovery: [4, -1],
    celebrate: [0, 0],
    rest: [0, 0],
    thinking: [-3, -4],
  };
  const [gx, gy] = gaze[pose];
  const pupil = (cx: number) =>
    `<circle cx="${cx + gx}" cy="${106 + gy}" r="6.8" fill="${INK}"/><circle cx="${cx + gx + 2.4}" cy="${102.6 + gy}" r="2.3" fill="#FFFFFF"/>`;
  return white(78) + white(122) + pupil(78) + pupil(122);
}

function brows(pose: MascotPose): string {
  const s = `fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"`;
  switch (pose) {
    case 'focus':
      return `<path d="M66 82 L88 85" ${s}/><path d="M112 85 L134 82" ${s}/>`;
    case 'encourage':
    case 'welcome':
      return `<path d="M68 80 Q78 74 88 79" ${s}/><path d="M112 79 Q122 74 132 80" ${s}/>`;
    case 'recovery':
      return `<path d="M68 81 Q78 77 88 80" ${s}/><path d="M112 79 Q122 74 132 78" ${s}/>`;
    case 'thinking':
      return `<path d="M68 82 Q78 78 88 82" ${s}/><path d="M112 78 Q122 72 132 77" ${s}/>`;
    default:
      return '';
  }
}

function mouth(pose: MascotPose): string {
  switch (pose) {
    case 'welcome':
    case 'celebrate':
    case 'encourage':
      return `<path d="M86 126 Q100 148 114 126 Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M93 136 Q100 132 107 136 Q100 144 93 136 Z" fill="${CORAL}"/>`;
    case 'focus':
      return `<path d="M93 132 Q100 135 107 132" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    case 'thinking':
      return `<ellipse cx="98" cy="133" rx="5" ry="6" fill="${INK}"/>`;
    default:
      return `<path d="M89 128 Q100 140 111 128" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  }
}

function arms(pose: MascotPose, color: string): { back: string; front: string } {
  switch (pose) {
    case 'welcome':
      return {
        back: '',
        front:
          limb('M44 128 Q30 144 38 162', color) +
          limb('M156 124 Q176 108 176 84', color) +
          `<path d="M186 70 Q192 78 190 88" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M194 64 Q203 76 199 92" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
      };
    case 'focus':
      return {
        back: '',
        front:
          limb('M44 128 Q52 150 72 152', color) +
          limb('M156 128 Q148 150 128 152', color) +
          `<rect x="66" y="140" width="68" height="40" rx="5" fill="#FFFFFF" stroke="${INK}" stroke-width="3.5"/><path d="M100 142 V178" stroke="${INK}" stroke-width="3"/><path d="M74 152 H92 M74 160 H92 M108 152 H126 M108 160 H122" stroke="#A39C91" stroke-width="3" stroke-linecap="round"/>`,
      };
    case 'encourage':
      return {
        back: '',
        front:
          limb('M44 128 Q28 132 36 150', color) +
          limb('M156 126 Q178 118 172 92', color) +
          `<circle cx="172" cy="86" r="10" fill="${color}" stroke="${INK}" stroke-width="3.5"/>` +
          sparkle(190, 64, 9, MARIGOLD) +
          sparkle(160, 56, 6, CORAL),
      };
    case 'recovery':
      return {
        back: '',
        front: limb('M44 130 Q30 146 40 162', color) + limb('M156 124 L190 112', color) + `<circle cx="192" cy="111" r="8" fill="${color}" stroke="${INK}" stroke-width="3.5"/>`,
      };
    case 'celebrate':
      return {
        back: '',
        front: limb('M42 120 Q12 100 18 66', color) + limb('M158 120 Q188 100 182 66', color) + `<circle cx="18" cy="62" r="8" fill="${color}" stroke="${INK}" stroke-width="3.5"/><circle cx="182" cy="62" r="8" fill="${color}" stroke="${INK}" stroke-width="3.5"/>`,
      };
    case 'thinking':
      return {
        back: '',
        front: limb('M44 130 Q32 146 40 162', color) + limb('M156 130 Q148 150 128 142', color),
      };
    case 'rest':
    default:
      return { back: '', front: limb('M44 132 Q36 150 46 164', color) + limb('M156 132 Q164 150 154 164', color) };
  }
}

function legs(pose: MascotPose): string {
  const shoe = (x: number, y: number, flip = false) =>
    `<g transform="translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}"><path d="M-16 0 Q-16 -11 -4 -11 L6 -11 Q18 -11 19 0 Z" fill="${CORAL}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><rect x="-17" y="-2" width="37" height="7" rx="3.5" fill="#FFFFFF" stroke="${INK}" stroke-width="3.5"/></g>`;
  const leg = (d: string) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`;
  if (pose === 'celebrate') return leg('M84 172 L78 186') + leg('M116 172 L124 184') + shoe(76, 194) + shoe(128, 192);
  if (pose === 'rest') return leg('M86 176 L86 194') + leg('M114 176 L114 194') + shoe(84, 204) + shoe(118, 204);
  // mid-stride: back foot heel lifted, front foot forward
  return leg('M86 176 L78 194') + leg('M116 176 L126 192') + `<g transform="rotate(-8 74 204)">${shoe(74, 204)}</g>` + shoe(132, 202);
}

function accessoryBack(acc: MascotAccessoryName): string {
  if (acc === 'backpack') return `<rect x="150" y="96" width="26" height="54" rx="10" fill="${MARIGOLD}" stroke="${INK}" stroke-width="3.5"/>`;
  return '';
}

function accessoryFront(acc: MascotAccessoryName): string {
  switch (acc) {
    case 'headphones':
      return `<path d="M46 98 C44 44 156 44 154 98" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><rect x="34" y="86" width="18" height="32" rx="8" fill="${CORAL}" stroke="${INK}" stroke-width="3.5"/><rect x="148" y="86" width="18" height="32" rx="8" fill="${CORAL}" stroke="${INK}" stroke-width="3.5"/>`;
    case 'cap':
      return `<path d="M58 72 C60 38 140 38 142 70 Z" fill="${LAGOON}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><path d="M132 64 C152 58 172 64 180 74 C162 78 146 76 132 72 Z" fill="${LAGOON}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="100" cy="42" r="4" fill="${INK}"/>`;
    case 'scarf':
      return `<path d="M42 146 C78 162 122 162 158 146 L160 160 C122 176 78 176 40 160 Z" fill="${CORAL}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><path d="M128 160 L136 190 L148 186 L142 158 Z" fill="${CORAL}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case 'glasses':
      return `<circle cx="78" cy="104" r="19" fill="#FFFFFF" fill-opacity="0.12" stroke="${INK}" stroke-width="4"/><circle cx="122" cy="104" r="19" fill="#FFFFFF" fill-opacity="0.12" stroke="${INK}" stroke-width="4"/><path d="M97 102 Q100 98 103 102" fill="none" stroke="${INK}" stroke-width="4"/>`;
    case 'backpack':
      return `<path d="M68 52 C60 90 58 120 62 150" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M68 52 C60 90 58 120 62 150" fill="none" stroke="${MARIGOLD}" stroke-width="5" stroke-linecap="round"/>`;
    case 'gradcap':
      return `<path d="M72 54 L72 40 L128 40 L128 54 Q100 62 72 54 Z" fill="${INK}"/><path d="M52 40 L100 22 L148 40 L100 58 Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M100 40 L140 50 L140 70" fill="none" stroke="${MARIGOLD}" stroke-width="3.5" stroke-linecap="round"/><circle cx="140" cy="72" r="4.5" fill="${MARIGOLD}" stroke="${INK}" stroke-width="2"/>`;
    case 'starpin':
      return sparkle(136, 150, 10, MARIGOLD);
    default:
      return '';
  }
}

function extras(pose: MascotPose): { behind: string; front: string } {
  switch (pose) {
    case 'recovery':
      return {
        behind: `<path d="M8 196 C30 150 20 110 52 82" fill="none" stroke="${LAGOON}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 12"/>`,
        front: `<path d="M170 168 C196 162 206 140 200 118" fill="none" stroke="${CORAL}" stroke-width="5" stroke-linecap="round" stroke-dasharray="10 9"/><path d="M190 124 L200 110 L208 126" fill="none" stroke="${CORAL}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
      };
    case 'celebrate':
      return {
        behind: '',
        front:
          `<rect x="20" y="40" width="10" height="16" rx="2" fill="${MARIGOLD}" stroke="${INK}" stroke-width="2" transform="rotate(-24 25 48)"/>` +
          `<rect x="172" y="30" width="10" height="16" rx="2" fill="${LAGOON}" stroke="${INK}" stroke-width="2" transform="rotate(28 177 38)"/>` +
          `<circle cx="54" cy="24" r="6" fill="${CORAL}" stroke="${INK}" stroke-width="2"/>` +
          `<circle cx="150" cy="16" r="5" fill="${VIOLET}" stroke="${INK}" stroke-width="2"/>` +
          `<path d="M186 70 L196 62 L198 76 Z" fill="${CORAL}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
          `<path d="M8 90 L18 80 L22 94 Z" fill="${LAGOON}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
          sparkle(100, 14, 9, MARIGOLD),
      };
    case 'rest':
      return {
        behind: '',
        front: `<path d="M168 30 A20 20 0 1 0 188 58 A15 15 0 1 1 168 30 Z" fill="${MARIGOLD}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` + sparkle(150, 60, 6, '#FFFFFF') + sparkle(190, 92, 5, '#FFFFFF'),
      };
    case 'thinking':
      return {
        behind: '',
        front: `<circle cx="164" cy="56" r="5" fill="#FFFFFF" stroke="${INK}" stroke-width="2.5"/><circle cx="178" cy="40" r="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2.5"/><circle cx="194" cy="18" r="12" fill="#FFFFFF" stroke="${INK}" stroke-width="2.5"/>`,
      };
    default:
      return { behind: '', front: '' };
  }
}

/** Inner SVG markup for Nex in a 0 0 210 220 coordinate space (no <svg> wrapper). */
export function mascotMarkup(opts: MascotOptions = {}): string {
  const pose = opts.pose ?? 'welcome';
  const skin = SKINS[opts.skin ?? 'violet'];
  const acc = opts.accessory ?? 'none';
  const lift = pose === 'celebrate' ? -10 : 0;
  const a = arms(pose, skin.body);
  const x = extras(pose);
  const shadow =
    opts.shadow === false ? '' : `<ellipse cx="102" cy="212" rx="${pose === 'celebrate' ? 38 : 50}" ry="6" fill="${INK}" fill-opacity="0.13"/>`;
  const body =
    `<path d="M100 40 C146 40 168 76 166 116 C164 156 138 180 100 180 C60 180 34 156 34 114 C34 72 56 40 100 40 Z" fill="${skin.body}" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M38 126 C44 160 68 178 100 178 C134 178 158 160 163 124 C150 150 128 162 100 162 C72 162 50 150 38 126 Z" fill="${skin.shade}" fill-opacity="0.55"/>` +
    `<ellipse cx="68" cy="66" rx="15" ry="8" fill="#FFFFFF" fill-opacity="0.38" transform="rotate(-32 68 66)"/>` +
    `<ellipse cx="62" cy="128" rx="8.5" ry="5" fill="${CORAL}" fill-opacity="0.65"/><ellipse cx="138" cy="128" rx="8.5" ry="5" fill="${CORAL}" fill-opacity="0.65"/>`;
  const tuft = `<path d="M97 42 C92 24 102 10 120 6 C118 22 110 36 97 42 Z" fill="${MARIGOLD}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><path d="M100 38 C104 28 110 20 116 13" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
  return (
    shadow +
    x.behind +
    `<g transform="translate(0 ${lift})">` +
    accessoryBack(acc) +
    legs(pose) +
    a.back +
    tuft +
    body +
    eyes(pose) +
    brows(pose) +
    mouth(pose) +
    accessoryFront(acc) +
    a.front +
    `</g>` +
    x.front
  );
}

export function mascotSvg(opts: MascotOptions & { size?: number } = {}): string {
  const size = opts.size;
  const label = opts.title ? `role="img" aria-label="${escapeXml(opts.title)}"` : 'aria-hidden="true"';
  const dims = size ? ` width="${size}" height="${Math.round((size * 220) / 210)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 220"${dims} ${label}>${opts.title ? `<title>${escapeXml(opts.title)}</title>` : ''}${mascotMarkup(opts)}</svg>`;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
