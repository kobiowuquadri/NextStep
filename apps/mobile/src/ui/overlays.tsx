import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Modal, View } from 'react-native';
import { badgeSvg, type BadgeKey } from '@nextstep/illustrations';
import { useApp } from '../lib/store';
import { Art, Button, Mascot, T } from './kit';
import { useTheme } from './theme';

export function ToastHost() {
  const toast = useApp((s) => s.toast);
  const { c } = useTheme();
  useEffect(() => {
    if (toast) AccessibilityInfo.announceForAccessibility(toast.text);
  }, [toast]);
  if (!toast) return null;
  const bg = toast.tone === 'reward' ? c.reward : toast.tone === 'warning' ? c.warningSoft : c.surfaceInverse;
  const fg = toast.tone === 'reward' ? c.textOnAccent : toast.tone === 'warning' ? c.warningText : c.textInverse;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 96, alignItems: 'center' }}>
      <View style={{ backgroundColor: bg, borderRadius: 16, borderWidth: 2, borderColor: c.borderStrong, paddingVertical: 12, paddingHorizontal: 16 }}>
        <T variant="bodyStrong" weight="800" style={{ color: fg }}>
          {toast.text}
        </T>
      </View>
    </View>
  );
}

/** Brief badge unlock / level-up. Scale-in only; skipped animation under reduced motion. */
export function CelebrationHost() {
  const { celebrations, levelUp, dismissCelebration, state } = useApp();
  const { c, reduceMotion } = useTheme();
  const current = celebrations[0] ?? null;
  const open = !!current || levelUp !== null;
  const scale = useRef(new Animated.Value(0.85)).current;
  useEffect(() => {
    if (!open) return;
    scale.setValue(reduceMotion ? 1 : 0.85);
    if (!reduceMotion) Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [open, current, reduceMotion, scale]);
  if (!open) return null;
  const prefs = state?.preferences;
  return (
    <Modal transparent animationType={reduceMotion ? 'none' : 'fade'} visible onRequestClose={dismissCelebration} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View accessibilityViewIsModal style={{ transform: [{ scale }], width: '100%', maxWidth: 360, alignItems: 'center', gap: 10, padding: 24, borderRadius: 28, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: c.rewardSoft }}>
          {current ? (
            <>
              <Art xml={badgeSvg(current.badge as BadgeKey)} width={140} label={`${current.title} badge`} />
              <T variant="label" color="primarySoftText">
                BADGE UNLOCKED
              </T>
              <T variant="h1" center>
                {current.title}
              </T>
              <T center color="textSecondary">
                {current.description}
              </T>
              {current.reward ? (
                <T variant="small" color="textMuted" center>
                  A new style for Nex is ready in Journey.
                </T>
              ) : null}
            </>
          ) : (
            <>
              <Mascot pose="celebrate" skin={prefs?.mascotSkin} accessory={prefs?.mascotAccessory} size={130} />
              <T variant="label" color="primarySoftText">
                LEVEL UP
              </T>
              <T variant="h1" center>
                Level {levelUp}
              </T>
              <T center color="textSecondary">
                Every step counted.
              </T>
            </>
          )}
          <Button label="Keep going" onPress={dismissCelebration} style={{ alignSelf: 'stretch' }} />
        </Animated.View>
      </View>
    </Modal>
  );
}
