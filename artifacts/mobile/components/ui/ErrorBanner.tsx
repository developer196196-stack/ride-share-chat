import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, withAlpha } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Icon } from './Icon';

/** Inline error/notice card for failed requests or blocked actions. */
export function ErrorBanner({
  message,
  tone = 'error',
  style,
}: {
  message: string;
  tone?: 'error' | 'warning';
  style?: StyleProp<ViewStyle>;
}) {
  const tint = tone === 'error' ? colors.destructive : colors.chart3;
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        { backgroundColor: withAlpha(tint, 0.08), borderColor: withAlpha(tint, 0.3) },
        style,
      ]}
    >
      <Icon name="solarShieldWarningBold" size={16} color={tint} />
      <Text style={[styles.text, { color: tint }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    ...textSize.xs,
    fontFamily: fonts.sans.semibold,
  },
});
