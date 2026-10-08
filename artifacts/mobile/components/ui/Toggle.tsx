import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';

type Props = {
  defaultValue?: boolean;
  /** Controlled value — pair with onValueChange. */
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  accessibilityLabel?: string;
  /** `sm` = w-10 h-5 (profile setup), `md` = w-11 h-6 (permissions/validation). */
  size?: 'sm' | 'md';
};

/** Sleek switch — uncontrolled by default (static screens) or controlled via `value`. */
export function Toggle({
  defaultValue = true,
  value,
  onValueChange,
  accessibilityLabel,
  size = 'md',
}: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const on = value ?? internal;
  const toggle = () => {
    const next = !on;
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };
  const dims = size === 'sm' ? styles.trackSm : styles.trackMd;

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: on }}
      style={[styles.track, dims, { backgroundColor: on ? colors.primary : colors.muted }]}
      hitSlop={8}
    >
      <View style={[styles.thumb, on ? styles.thumbOn : styles.thumbOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.full,
    justifyContent: 'center',
  },
  trackSm: {
    width: 40,
    height: 20,
    padding: 2,
  },
  trackMd: {
    width: 44,
    height: 24,
    padding: 4,
  },
  thumb: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: colors.primaryForeground,
    ...shadow.xs,
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },
  thumbOff: {
    alignSelf: 'flex-start',
  },
});
