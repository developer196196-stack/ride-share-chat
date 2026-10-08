import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, withAlpha } from '@/constants/colors';
import { MAX_CONTENT_WIDTH, radius, shadow } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Icon } from '@/components/ui';
import { useTripStore } from '@/stores/trip.store';
import { SafetySheet } from './SafetySheet';

/**
 * "Ride verified — share your trip?" banner, shown once per ride when the rider enabled
 * "Offer to share when VERIFIED". Messages still go out through the rider's own apps.
 */
export function SharePrompt() {
  const insets = useSafeAreaInsets();
  const pending = useTripStore((s) => s.sharePromptPending);
  const setPending = useTripStore((s) => s.setSharePromptPending);
  const [open, setOpen] = useState(false);

  if (!pending && !open) return null;

  return (
    <>
      {pending ? (
        <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.banner}>
            <Icon name="solarShieldCheckBold" size={20} color={colors.accent} />
            <View style={styles.text}>
              <Text style={styles.title}>Ride verified</Text>
              <Text style={styles.caption}>Share your live trip status with trusted contacts?</Text>
            </View>
            <Pressable
              style={styles.share}
              onPress={() => {
                setPending(false);
                setOpen(true);
              }}
            >
              <Text style={styles.shareText}>Share</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => setPending(false)} accessibilityLabel="Dismiss">
              <Icon name="solarCloseCircleLinear" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>
      ) : null}
      <SafetySheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  banner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius['2xl'],
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.4),
    ...shadow.lg,
  },
  text: { flex: 1 },
  title: { ...textSize.sm, fontFamily: fonts.sans.bold, color: colors.foreground },
  caption: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  share: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.primary },
  shareText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.primaryForeground },
});
