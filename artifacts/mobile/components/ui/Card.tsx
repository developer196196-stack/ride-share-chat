import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tailwind rounded-* key; Sleek cards are mostly `rounded-2xl`. */
  rounded?: keyof typeof radius;
  elevated?: boolean;
};

/** `rounded-2xl border border-border bg-card shadow-xs` surface. */
export function Card({ children, style, rounded = '2xl', elevated = true }: Props) {
  return (
    <View style={[styles.card, { borderRadius: radius[rounded] }, elevated && shadow.xs, style]}>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
