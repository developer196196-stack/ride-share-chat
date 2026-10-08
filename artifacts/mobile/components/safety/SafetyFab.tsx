import React, { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/constants/colors';
import { radius, tintedShadow } from '@/constants/layout';
import { Icon } from '@/components/ui';
import { SafetySheet } from './SafetySheet';

/** Persistent safety shield (R.O.O.M. and pre-verification screens). */
export function SafetyFab({ style }: { style?: StyleProp<ViewStyle> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }, style]}
        accessibilityRole="button"
        accessibilityLabel="Safety options"
        hitSlop={8}
      >
        <Icon name="solarShieldCheckBold" size={24} color={colors.primaryForeground} />
      </Pressable>
      <SafetySheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...tintedShadow(colors.primary, 0.35, 'lg'),
  },
});
