import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { colors } from './colors';

/** Sleek `--radius: 0.75rem` scale (rounded-lg = radius, xl = +4, 2xl = +8, 3xl = +16). */
export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 28,
  full: 9999,
} as const;

/** Tailwind shadow scale, tuned for React Native. */
export const shadow = {
  xs: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.12,
    shadowRadius: 25,
    elevation: 12,
  },
  '2xl': {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.25,
    shadowRadius: 50,
    elevation: 16,
  },
} satisfies Record<string, ViewStyle>;

/** Colored glow shadow, e.g. `shadow-lg shadow-primary/25`. */
export function tintedShadow(color: string, opacity = 0.25, size: keyof typeof shadow = 'lg'): ViewStyle {
  return { ...shadow[size], shadowColor: color, shadowOpacity: opacity };
}

/** Sleek screens are designed at `max-w-md`. */
export const MAX_CONTENT_WIDTH = 448;

/** Removes the browser focus ring react-native-web draws around TextInputs. */
export const webInputReset: TextStyle =
  Platform.OS === 'web' ? { outlineWidth: 0 } : {};
