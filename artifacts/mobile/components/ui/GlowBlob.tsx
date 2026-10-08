import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

type Props = {
  color: string;
  /** Peak opacity at the center (Sleek `bg-primary/15`). */
  opacity: number;
  size: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Soft radial glow standing in for Tailwind `rounded-full bg-* blur-3xl`
 * (React Native has no CSS blur filter on plain views).
 */
export function GlowBlob({ color, opacity, size, style }: Props) {
  const id = `glow-${useId().replace(/:/g, '')}`;
  return (
    <View pointerEvents="none" style={[styles.base, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity * 1.6} />
            <Stop offset="0.55" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
  },
});
