import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Icon } from '@/components/ui';
import { useTripStore } from '@/stores/trip.store';

const VISIBLE_MS = 4_500;

/** Short app-wide notice (host moderation: muted, removed from a room, action confirmations). */
export function NoticeToast() {
  const notice = useTripStore((s) => s.notice);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      // Only clear the notice this timer was started for.
      if (useTripStore.getState().notice?.at === notice.at) useTripStore.getState().setNotice(null);
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  const tint = notice.tone === 'warning' ? colors.chart3 : colors.accent;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Animated.View key={notice.at} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
        <Pressable
          onPress={() => useTripStore.getState().setNotice(null)}
          style={[styles.toast, { borderColor: withAlpha(tint, 0.35) }]}
          accessibilityRole="alert"
          accessibilityLabel={notice.message}
        >
          <Icon name={notice.tone === 'warning' ? 'solarShieldWarningBold' : 'solarCheckCircleBold'} size={18} color={tint} />
          <Text style={styles.text}>{notice.message}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 50, elevation: 50 },
  toast: {
    maxWidth: 448,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: colors.card,
    ...shadow.lg,
  },
  text: { flexShrink: 1, ...textSize.sm, fontFamily: fonts.sans.semibold, color: colors.foreground },
});
