import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/constants/colors';
import { radius } from '@/constants/layout';

/** Tailwind `animate-pulse` — fades a child between full and half opacity. */
export function Pulse({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.5, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1,
    );
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** `size-2 rounded-full bg-accent animate-pulse` live indicator. */
export function LiveDot({ color = colors.accent, size = 8, pulse = true }: { color?: string; size?: number; pulse?: boolean }) {
  const dot = { width: size, height: size, borderRadius: radius.full, backgroundColor: color };
  return pulse ? <Pulse style={dot} /> : <Animated.View style={dot} />;
}

/** Tailwind `animate-ping` — scales out and fades. */
export function Ping({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }), -1);
  }, [progress]);
  const animated = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 1 + progress.value }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Tailwind `animate-spin`. */
export function Spin({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1);
  }, [rotation]);
  const animated = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** Tailwind `animate-bounce`. */
export function Bounce({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 500, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) }),
      ),
      -1,
    );
  }, [y]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
