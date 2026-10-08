import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, withAlpha } from '@/constants/colors';
import { radius, tintedShadow } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import type { IconName } from '@/constants/icons';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'destructiveSoft';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  iconSize?: number;
  iconPosition?: 'left' | 'right';
  iconColor?: string;
  height?: number;
  borderRadius?: number;
  /** Tailwind text size key for the label. */
  size?: 'xs' | 'sm' | 'base';
  weight?: 'semibold' | 'bold' | 'extrabold';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

const VARIANTS: Record<Variant, { container: ViewStyle; text: string }> = {
  primary: {
    container: { backgroundColor: colors.primary, ...tintedShadow(colors.primary, 0.25) },
    text: colors.primaryForeground,
  },
  secondary: {
    container: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: colors.secondaryForeground,
  },
  outline: {
    container: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    text: colors.foreground,
  },
  destructive: {
    container: { backgroundColor: colors.destructive, ...tintedShadow(colors.destructive, 0.2, 'md') },
    text: colors.destructiveForeground,
  },
  destructiveSoft: {
    container: {
      backgroundColor: withAlpha(colors.destructive, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.destructive, 0.3),
    },
    text: colors.destructive,
  },
};

const WEIGHTS = {
  semibold: fonts.sans.semibold,
  bold: fonts.sans.bold,
  extrabold: fonts.sans.extrabold,
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  iconSize = 18,
  iconPosition = 'right',
  iconColor,
  height = 52,
  borderRadius = radius['2xl'],
  size = 'base',
  weight = 'bold',
  style,
  labelStyle,
}: Props) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  const iconNode = loading ? (
    <ActivityIndicator size="small" color={v.text} />
  ) : icon ? (
    <Icon name={icon} size={iconSize} color={iconColor ?? v.text} />
  ) : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        v.container,
        { height, borderRadius },
        pressed && !inactive && styles.pressed,
        disabled && !loading && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {iconPosition === 'left' && iconNode}
        <Text
          style={[
            styles.label,
            textSize[size],
            { color: v.text, fontFamily: WEIGHTS[weight] },
            labelStyle,
          ]}
        >
          {label}
        </Text>
        {iconPosition === 'right' && iconNode}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    textAlign: 'center',
  },
});
