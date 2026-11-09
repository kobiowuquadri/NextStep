import { describe, expect, it } from 'vitest';
import {
  ACCESSORY_LABELS,
  BADGE_KEYS,
  SCENES,
  SKINS,
  badgeSvg,
  heroSceneSvg,
  logoMarkSvg,
  mascotSvg,
  sceneSvg,
  type MascotAccessoryName,
  type MascotPose,
  type MascotSkinName,
  type SceneName,
} from './index.js';

const POSES: MascotPose[] = ['welcome', 'focus', 'encourage', 'recovery', 'celebrate', 'rest', 'thinking'];

/** Minimal well-formedness check: every opened element is closed in order. */
function assertWellFormed(svg: string) {
  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) expect(stack.pop(), `unexpected </${name}>`).toBe(name);
    else stack.push(name!);
  }
  expect(stack).toEqual([]);
}

/** Rendered inline on the web, so artwork must never carry scripts, handlers or remote references. */
function assertSafe(svg: string) {
  expect(svg).not.toMatch(/<script|<foreignObject|\son\w+=|javascript:|href="http/i);
}

describe('mascot', () => {
  it('renders every pose, skin and accessory as safe, well-formed SVG', () => {
    for (const pose of POSES) {
      for (const skin of Object.keys(SKINS) as MascotSkinName[]) {
        for (const accessory of Object.keys(ACCESSORY_LABELS) as MascotAccessoryName[]) {
          const svg = mascotSvg({ pose, skin, accessory, size: 120 });
          assertWellFormed(svg);
          assertSafe(svg);
        }
      }
    }
  });

  it('uses the skin colour', () => {
    expect(mascotSvg({ skin: 'mint' })).toContain(`fill="${SKINS.mint.body}"`);
    expect(mascotSvg({ skin: 'violet' })).not.toContain(`fill="${SKINS.mint.body}"`);
    expect(mascotSvg({ skin: 'violet' })).toContain(`fill="${SKINS.violet.body}"`);
  });

  it('is decorative by default and escapes accessible titles', () => {
    expect(mascotSvg()).toContain('aria-hidden="true"');
    const titled = mascotSvg({ title: 'Nex <b>& "friends"' });
    expect(titled).toContain('role="img"');
    expect(titled).toContain('Nex &lt;b&gt;&amp; &quot;friends&quot;');
    expect(titled).not.toContain('<b>');
    assertWellFormed(titled);
  });
});

describe('scenes, badges and logo', () => {
  it('renders every scene without embedded text', () => {
    for (const name of Object.keys(SCENES) as SceneName[]) {
      const svg = sceneSvg(name);
      assertWellFormed(svg);
      assertSafe(svg);
      expect(svg, name).not.toMatch(/<text/);
    }
    const hero = heroSceneSvg('Nex hopping to the next stepping stone');
    assertWellFormed(hero);
    assertSafe(hero);
  });

  it('renders every badge, locked and unlocked', () => {
    expect(BADGE_KEYS).toHaveLength(10);
    for (const key of BADGE_KEYS) {
      for (const locked of [false, true]) {
        const svg = badgeSvg(key, { locked, size: 64, title: key });
        assertWellFormed(svg);
        assertSafe(svg);
      }
    }
    expect(badgeSvg('map', { locked: true })).not.toBe(badgeSvg('map'));
  });

  it('renders the logo mark', () => {
    const svg = logoMarkSvg({ size: 32, title: 'NextStep' });
    assertWellFormed(svg);
    assertSafe(svg);
  });
});
