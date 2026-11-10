import { INK, escapeXml } from './mascot.js';

export const BADGE_KEYS = ['footprint', 'reroute', 'notebook', 'calendar', 'blocks', 'map', 'leaf', 'bulb', 'door', 'bridge'] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

const THEMES: Record<BadgeKey, { fill: string; ring: string }> = {
  footprint: { fill: '#6A4DFF', ring: '#CABFFF' },
  reroute: { fill: '#FF7D5E', ring: '#FFD9CF' },
  notebook: { fill: '#2FB8CB', ring: '#C5EEF3' },
  calendar: { fill: '#5CC98E', ring: '#C3EBD3' },
  blocks: { fill: '#FFC52E', ring: '#FFEDB3' },
  map: { fill: '#8670FF', ring: '#E4DEFF' },
  leaf: { fill: '#1E9E5A', ring: '#C3EBD3' },
  bulb: { fill: '#F5B000', ring: '#FFEDB3' },
  door: { fill: '#149EB3', ring: '#C5EEF3' },
  bridge: { fill: '#F2603D', ring: '#FFD9CF' },
};

/** Ink stroke attributes; pass a width instead of appending a second stroke-width (duplicate attributes are invalid XML). */
const st = (width = 3) => `stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;

const ICONS: Record<BadgeKey, string> = {
  footprint: `<path d="M34 70 Q34 52 48 52 L58 52 Q64 52 66 58 L76 62 Q88 64 88 72 L88 74 H34 Z" fill="#FFFFFF" ${st()}/><rect x="32" y="72" width="58" height="8" rx="4" fill="#FFFFFF" ${st()}/><path d="M56 60 L60 56 M62 64 L66 60" ${st(2.5)}/><path d="M40 40 Q46 34 52 40" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`,
  reroute: `<path d="M40 74 C40 50 56 50 60 50" fill="none" ${st(5)}/><path d="M60 50 C76 50 80 40 80 34" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-dasharray="6 6"/><path d="M72 40 L80 30 L88 40" fill="none" ${st(4.5)}/><circle cx="40" cy="76" r="5" fill="#FFFFFF" ${st()}/>`,
  notebook: `<rect x="42" y="32" width="38" height="46" rx="5" fill="#FFFFFF" ${st()}/><path d="M50 44 H72 M50 53 H72 M50 62 H64" ${st()}/><circle cx="42" cy="40" r="3" fill="${INK}"/><circle cx="42" cy="55" r="3" fill="${INK}"/><circle cx="42" cy="70" r="3" fill="${INK}"/>`,
  calendar: `<rect x="38" y="36" width="44" height="40" rx="6" fill="#FFFFFF" ${st()}/><path d="M38 47 H82" ${st()}/><path d="M48 30 V40 M72 30 V40" ${st()}/><path d="M50 61 L57 68 L71 54" fill="none" ${st(4)}/>`,
  blocks: `<rect x="38" y="56" width="22" height="22" rx="5" fill="#FFFFFF" ${st()}/><rect x="62" y="56" width="22" height="22" rx="5" fill="#FFFFFF" ${st()}/><rect x="50" y="32" width="22" height="22" rx="5" fill="#FFFFFF" ${st()}/>`,
  map: `<path d="M36 38 L52 32 L68 38 L84 32 V74 L68 80 L52 74 L36 80 Z" fill="#FFFFFF" ${st()}/><path d="M52 32 V74 M68 38 V80" ${st(2)}/><path d="M44 66 C50 52 60 64 74 46" fill="none" stroke="${INK}" stroke-width="2.5" stroke-dasharray="3 4" stroke-linecap="round"/>`,
  leaf: `<path d="M38 76 C38 46 58 32 84 32 C84 58 70 78 38 76 Z" fill="#FFFFFF" ${st()}/><path d="M40 74 C54 62 64 52 76 40" fill="none" ${st()}/>`,
  bulb: `<path d="M60 30 C44 30 38 42 38 50 C38 60 46 64 48 72 H72 C74 64 82 60 82 50 C82 42 76 30 60 30 Z" fill="#FFFFFF" ${st()}/><rect x="49" y="74" width="22" height="9" rx="3" fill="#FFFFFF" ${st()}/><path d="M54 58 L60 64 L66 58" fill="none" ${st(2.5)}/>`,
  door: `<rect x="42" y="30" width="34" height="50" rx="4" fill="#FFFFFF" ${st()}/><path d="M76 30 L88 36 V76 L76 80" fill="#FFFFFF" ${st()}/><circle cx="68" cy="56" r="3" fill="${INK}"/><path d="M50 56 H62 M56 50 L62 56 L56 62" fill="none" ${st(2.5)}/>`,
  bridge: `<path d="M30 50 H90" ${st(5)}/><path d="M36 76 C42 54 78 54 84 76" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/><path d="M36 76 C42 54 78 54 84 76" fill="none" ${st()}/><path d="M46 50 V62 M60 50 V57 M74 50 V62" ${st(2.5)}/><path d="M34 84 Q40 80 46 84 T58 84 T70 84 T82 84" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>`,
};

export function badgeSvg(key: BadgeKey, opts: { size?: number; locked?: boolean; title?: string } = {}): string {
  const t = THEMES[key];
  const fill = opts.locked ? '#CFC7BA' : t.fill;
  const ring = opts.locked ? '#F3EDE3' : t.ring;
  const dims = opts.size ? ` width="${opts.size}" height="${opts.size}"` : '';
  const label = opts.title ? `role="img" aria-label="${escapeXml(opts.title)}"` : 'aria-hidden="true"';
  const ribbon = `<path d="M42 92 L34 116 L46 110 L52 118 L58 96 Z" fill="${fill}" ${st(2.5)}/><path d="M78 92 L86 116 L74 110 L68 118 L62 96 Z" fill="${fill}" ${st(2.5)}/>`;
  const scallop = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `<circle cx="${(60 + Math.cos(a) * 42).toFixed(1)}" cy="${(56 + Math.sin(a) * 42).toFixed(1)}" r="9" fill="${ring}" stroke="${INK}" stroke-width="3"/>`;
  }).join('');
  const lock = opts.locked
    ? `<g transform="translate(78 74)"><rect x="0" y="8" width="22" height="18" rx="4" fill="#FFFFFF" ${st()}/><path d="M5 9 V4 a6 6 0 0 1 12 0 V9" fill="none" ${st()}/></g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"${dims} ${label}>${opts.title ? `<title>${escapeXml(opts.title)}</title>` : ''}${ribbon}${scallop}<circle cx="60" cy="56" r="42" fill="${ring}"/><circle cx="60" cy="56" r="33" fill="${fill}" stroke="${INK}" stroke-width="3"/><g${opts.locked ? ' opacity="0.45"' : ''}>${ICONS[key]}</g>${lock}</svg>`;
}
