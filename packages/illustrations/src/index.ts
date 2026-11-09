export * from './mascot.js';
export * from './scenes.js';
export * from './badges.js';

/** Brand mark: a rounded tile with a forward step and the leaf tuft. */
export function logoMarkSvg(opts: { size?: number; title?: string; color?: string } = {}): string {
  const dims = opts.size ? ` width="${opts.size}" height="${opts.size}"` : '';
  const label = opts.title ? `role="img" aria-label="${opts.title}"` : 'aria-hidden="true"';
  const fill = opts.color ?? '#6A4DFF';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${dims} ${label}><rect x="3" y="5" width="56" height="56" rx="16" fill="#17142E"/><rect x="2" y="2" width="56" height="56" rx="16" fill="${fill}" stroke="#17142E" stroke-width="3"/><path d="M14 44 H26 V34 H38 V24 H48" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 22 C44 14 48 8 56 6 C55 13 52 19 46 22 Z" fill="#FFC52E" stroke="#17142E" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}
