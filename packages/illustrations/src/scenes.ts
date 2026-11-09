import { INK, mascotMarkup, escapeXml, type MascotPose } from './mascot.js';

const C = {
  violet: '#6A4DFF',
  violetLight: '#CABFFF',
  violetSoft: '#F2EFFF',
  coral: '#FF7D5E',
  coralSoft: '#FFD9CF',
  marigold: '#FFC52E',
  marigoldSoft: '#FFEDB3',
  lagoon: '#2FB8CB',
  lagoonSoft: '#C5EEF3',
  mint: '#5CC98E',
  mintSoft: '#C3EBD3',
  sand: '#E6DFD3',
  sandDark: '#CFC7BA',
  paper: '#FFFFFF',
  grey: '#A39C91',
};

const wrap = (viewBox: string, body: string, title?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${title ? `role="img" aria-label="${escapeXml(title)}"` : 'aria-hidden="true"'}>${title ? `<title>${escapeXml(title)}</title>` : ''}${body}</svg>`;

const nex = (x: number, y: number, scale: number, pose: MascotPose, shadow = true) =>
  `<g transform="translate(${x} ${y}) scale(${scale})">${mascotMarkup({ pose, shadow })}</g>`;

const stone = (cx: number, cy: number, rx: number, ry: number, top = C.sand, side = C.sandDark) =>
  `<ellipse cx="${cx}" cy="${cy + 7}" rx="${rx}" ry="${ry}" fill="${side}" stroke="${INK}" stroke-width="3"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${top}" stroke="${INK}" stroke-width="3"/>`;

const sparkle = (x: number, y: number, r: number, color: string) =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${color}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;

/** A tactile card: ink offset shadow, white face, ink border. */
const card = (x: number, y: number, w: number, h: number, inner: string, r = 16) =>
  `<rect x="${x + 6}" y="${y + 7}" width="${w}" height="${h}" rx="${r}" fill="${INK}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${C.paper}" stroke="${INK}" stroke-width="3"/>${inner}`;

/** A session pill: coloured marker, placeholder text bars (no real text in artwork). */
const pill = (x: number, y: number, w: number, color: string, opts: { dashed?: boolean; done?: boolean } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="26" rx="13" fill="${opts.dashed ? '#FFFFFF' : color + '33'}" stroke="${opts.dashed ? color : INK}" stroke-width="${opts.dashed ? 3 : 2}"${opts.dashed ? ' stroke-dasharray="7 6"' : ''}/>` +
  `<circle cx="${x + 14}" cy="${y + 13}" r="6" fill="${color}" stroke="${INK}" stroke-width="2"/>` +
  `<rect x="${x + 28}" y="${y + 9}" width="${w * 0.42}" height="8" rx="4" fill="${opts.dashed ? color + '66' : INK}" fill-opacity="${opts.dashed ? 1 : 0.75}"/>` +
  (opts.done ? `<circle cx="${x + w - 15}" cy="${y + 13}" r="8" fill="${C.mint}" stroke="${INK}" stroke-width="2"/><path d="M${x + w - 19} ${y + 13} l3 3 l6 -6" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : '');

const cloud = (x: number, y: number, s = 1) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M10 40 Q0 40 0 30 Q0 18 14 18 Q18 2 36 4 Q50 0 56 14 Q74 12 74 28 Q76 40 64 40 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;

/** Website hero: a week of plans being re-routed while Nex keeps stepping forward. */
export function heroSceneSvg(title?: string): string {
  const body =
    `<circle cx="350" cy="290" r="232" fill="${C.violetSoft}"/>` +
    `<circle cx="560" cy="92" r="46" fill="${C.marigoldSoft}" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="560" cy="92" r="30" fill="${C.marigold}"/>` +
    cloud(70, 70, 1.1) +
    cloud(440, 150, 0.8) +
    // the path
    `<path d="M70 486 C160 470 210 452 280 430 C350 408 380 370 440 330 C500 290 520 240 584 210" fill="none" stroke="${C.violetLight}" stroke-width="10" stroke-linecap="round" stroke-dasharray="1 22"/>` +
    stone(84, 476, 40, 13) +
    stone(178, 452, 38, 12) +
    // the stone that moved: ghost outline where it was, and the new route
    `<ellipse cx="372" cy="470" rx="36" ry="12" fill="none" stroke="${C.grey}" stroke-width="3" stroke-dasharray="8 7"/>` +
    stone(316, 438, 44, 14, C.coralSoft, C.coral) +
    `<path d="M360 436 C380 410 384 392 390 372" fill="none" stroke="${C.coral}" stroke-width="5" stroke-linecap="round" stroke-dasharray="11 9"/><path d="M380 380 L391 366 L401 382" fill="none" stroke="${C.coral}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    stone(410, 372, 38, 12, C.lagoonSoft, C.lagoon) +
    stone(498, 300, 34, 11) +
    stone(570, 228, 32, 10, C.marigoldSoft, C.marigold) +
    // goal flag
    `<path d="M570 228 V150" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M572 152 L622 166 L572 184 Z" fill="${C.coral}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    // plan card
    card(
      34,
      150,
      232,
      176,
      `<rect x="54" y="170" width="62" height="10" rx="5" fill="${INK}"/><rect x="54" y="186" width="96" height="7" rx="3.5" fill="${C.grey}"/>` +
        pill(52, 208, 196, C.violet, { done: true }) +
        pill(52, 244, 196, C.lagoon, { dashed: true }) +
        pill(52, 280, 196, C.coral),
    ) +
    `<path d="M248 257 C292 262 300 300 286 330" fill="none" stroke="${C.lagoon}" stroke-width="4" stroke-linecap="round" stroke-dasharray="9 8"/>` +
    // XP card
    card(
      430,
      398,
      182,
      92,
      `<circle cx="464" cy="430" r="16" fill="${C.marigold}" stroke="${INK}" stroke-width="3"/>` +
        sparkle(464, 430, 8, '#FFFFFF') +
        `<rect x="490" y="420" width="90" height="9" rx="4.5" fill="${INK}"/><rect x="490" y="436" width="60" height="7" rx="3.5" fill="${C.grey}"/>` +
        `<rect x="450" y="458" width="142" height="16" rx="8" fill="${C.violetSoft}" stroke="${INK}" stroke-width="2.5"/><rect x="452" y="460" width="98" height="12" rx="6" fill="${C.violet}"/>`,
    ) +
    nex(232, 256, 0.82, 'recovery', false) +
    sparkle(612, 270, 9, C.marigold) +
    sparkle(332, 96, 8, C.coral) +
    sparkle(216, 380, 6, C.lagoon);
  return wrap('0 0 640 520', body, title);
}

function onboardingOrganise(): string {
  const body =
    `<circle cx="210" cy="124" r="96" fill="${C.lagoonSoft}"/>` +
    card(150, 40, 140, 52, `${pill(160, 53, 120, C.violet, { done: true })}`, 14) +
    card(170, 104, 130, 52, `${pill(180, 117, 110, C.coral)}`, 14) +
    card(150, 168, 140, 52, `${pill(160, 181, 120, C.lagoon)}`, 14) +
    nex(8, 52, 0.78, 'focus');
  return wrap('0 0 320 240', body);
}

function onboardingPlan(): string {
  const step = (x: number, y: number, h: number, color: string) =>
    `<rect x="${x + 5}" y="${y + 6}" width="70" height="${h}" rx="10" fill="${INK}"/><rect x="${x}" y="${y}" width="70" height="${h}" rx="10" fill="${color}" stroke="${INK}" stroke-width="3"/>`;
  const body =
    `<circle cx="170" cy="120" r="100" fill="${C.violetSoft}"/>` +
    step(40, 170, 50, C.sand) +
    step(120, 130, 90, C.marigoldSoft) +
    step(200, 86, 134, C.lagoonSoft) +
    `<path d="M236 86 V36" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><path d="M238 38 L276 48 L238 60 Z" fill="${C.coral}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    nex(114, 30, 0.5, 'welcome') +
    sparkle(60, 120, 8, C.marigold) +
    sparkle(290, 110, 6, C.violet);
  return wrap('0 0 320 240', body);
}

function onboardingRecover(): string {
  const body =
    `<circle cx="170" cy="120" r="100" fill="${C.coralSoft}" fill-opacity="0.7"/>` +
    `<path d="M20 200 C70 196 100 190 130 182" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="M20 200 C70 196 100 190 130 182" fill="none" stroke="${C.sand}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M188 168 C230 156 262 140 300 120" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="M188 168 C230 156 262 140 300 120" fill="none" stroke="${C.sand}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M136 176 C150 120 196 120 214 154" fill="none" stroke="${C.coral}" stroke-width="5" stroke-linecap="round" stroke-dasharray="10 8"/><path d="M204 150 L215 159 L222 145" fill="none" stroke="${C.coral}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
    nex(40, 52, 0.62, 'recovery', false) +
    sparkle(286, 70, 8, C.marigold);
  return wrap('0 0 320 240', body);
}

function emptyTasks(): string {
  const lines = [0, 1, 2]
    .map((i) => `<rect x="134" y="${60 + i * 30}" width="18" height="18" rx="5" fill="#FFFFFF" stroke="${INK}" stroke-width="2.5"/><rect x="160" y="${65 + i * 30}" width="${50 - i * 8}" height="8" rx="4" fill="${C.sand}" stroke="${C.sandDark}" stroke-width="1.5" stroke-dasharray="4 3"/>`)
    .join('');
  return wrap('0 0 240 180', `<circle cx="120" cy="96" r="76" fill="${C.violetSoft}"/>` + card(120, 42, 104, 108, lines, 14) + nex(4, 26, 0.62, 'thinking'));
}

function emptyPlan(): string {
  let grid = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) grid += `<rect x="${118 + c * 24}" y="${68 + r * 24}" width="18" height="18" rx="5" fill="${r === 1 && c === 2 ? C.marigoldSoft : C.violetSoft}" stroke="${INK}" stroke-width="2"/>`;
  return wrap(
    '0 0 240 180',
    `<circle cx="120" cy="96" r="76" fill="${C.lagoonSoft}"/>` + card(106, 34, 118, 120, `<rect x="106" y="34" width="118" height="24" rx="14" fill="${C.violet}" stroke="${INK}" stroke-width="3"/>${grid}`, 14) + nex(0, 32, 0.6, 'welcome'),
  );
}

function emptyResources(): string {
  const book = (x: number, y: number, w: number, color: string) => `<rect x="${x}" y="${y}" width="${w}" height="22" rx="5" fill="${color}" stroke="${INK}" stroke-width="3"/><rect x="${x + 8}" y="${y + 8}" width="${w * 0.4}" height="6" rx="3" fill="#FFFFFF"/>`;
  return wrap('0 0 240 180', `<circle cx="120" cy="96" r="76" fill="${C.marigoldSoft}"/>` + book(126, 126, 96, C.lagoon) + book(134, 102, 84, C.coral) + book(122, 78, 92, C.violet) + nex(6, 30, 0.6, 'focus'));
}

function emptyDone(): string {
  return wrap('0 0 240 180', `<circle cx="120" cy="96" r="76" fill="${C.violetSoft}"/>` + stone(120, 160, 70, 12, C.mintSoft, C.mint) + nex(58, 8, 0.66, 'rest', false));
}

function emptyOffline(): string {
  return wrap(
    '0 0 240 180',
    `<circle cx="120" cy="96" r="76" fill="${C.lagoonSoft}"/>` +
      cloud(130, 50, 1.2) +
      `<path d="M150 50 L210 104" stroke="${C.coral}" stroke-width="6" stroke-linecap="round"/>` +
      nex(4, 30, 0.6, 'encourage'),
  );
}

function emptyJourney(): string {
  return wrap(
    '0 0 240 180',
    `<circle cx="120" cy="96" r="76" fill="${C.marigoldSoft}"/>` +
      `<path d="M40 160 C90 150 130 120 150 96 C170 70 190 56 214 48" fill="none" stroke="${C.violetLight}" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 16"/>` +
      stone(150, 104, 22, 8, C.lagoonSoft, C.lagoon) +
      stone(204, 58, 20, 7, C.marigoldSoft, C.marigold) +
      nex(14, 46, 0.56, 'welcome'),
  );
}

export const SCENES = {
  onboardingOrganise,
  onboardingPlan,
  onboardingRecover,
  emptyTasks,
  emptyPlan,
  emptyResources,
  emptyDone,
  emptyOffline,
  emptyJourney,
} as const;
export type SceneName = keyof typeof SCENES;

export function sceneSvg(name: SceneName): string {
  return SCENES[name]();
}
