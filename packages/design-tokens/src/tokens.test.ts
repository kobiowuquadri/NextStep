import { describe, expect, it } from 'vitest';
import { contrastRatio, themes } from './index';

describe('semantic colour contrast (WCAG AA)', () => {
  for (const name of ['light', 'dark'] as const) {
    const t = themes[name];

    it(`${name}: body text meets AA on canvas and surface`, () => {
      for (const bg of [t.canvas, t.surface, t.surfaceSubtle]) {
        expect(contrastRatio(t.textPrimary, bg)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(t.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(t.textMuted, bg)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name}: primary button text meets AA`, () => {
      expect(contrastRatio(t.textOnPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: status text on its soft background meets AA`, () => {
      const pairs: Array<[string, string]> = [
        [t.successText, t.successSoft],
        [t.warningText, t.warningSoft],
        [t.dangerText, t.dangerSoft],
        [t.rewardText, t.rewardSoft],
        [t.primarySoftText, t.primarySoft],
        [t.calmText, t.calmSoft],
        [t.energyText, t.energySoft],
      ];
      for (const [fg, bg] of pairs) expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: accent fills carry dark text legibly`, () => {
      expect(contrastRatio(t.textOnAccent, t.reward)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.textOnAccent, t.energy)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: borders and focus ring are visible against surfaces`, () => {
      expect(contrastRatio(t.focusRing, t.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.borderStrong, t.surface)).toBeGreaterThanOrEqual(3);
    });
  }
});
