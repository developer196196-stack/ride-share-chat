import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { fonts, textSize } from '@/constants/typography';

type Props = {
  label: string;
  value: string;
  valueStyle?: StyleProp<TextStyle>;
  mono?: boolean;
};

/** `flex justify-between text-xs` label/value telemetry row. */
export function StatRow({ label, value, valueStyle, mono = false }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono, valueStyle]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    flexShrink: 1,
  },
  value: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
    textAlign: 'right',
    flexShrink: 1,
  },
  mono: {
    fontFamily: fonts.mono.bold,
  },
});
