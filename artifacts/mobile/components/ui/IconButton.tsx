import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';
import type { IconName } from '@/constants/icons';
import { Icon } from './Icon';

type Props = {
  icon: IconName;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  shape?: 'circle' | 'rounded';
  style?: StyleProp<ViewStyle>;
};

/** `size-10 rounded-full border border-border bg-card shadow-xs` icon button. */
export function IconButton({
  icon,
  onPress,
  size = 40,
  iconSize = 20,
  color = colors.mutedForeground,
  shape = 'circle',
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: shape === 'circle' ? radius.full : radius.xl },
        pressed && { backgroundColor: colors.secondary },
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadow.xs,
  },
});
