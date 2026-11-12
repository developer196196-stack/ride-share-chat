import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { colors } from './colors';

/**
 * Corner radii. Client brief: ultra-rounded buttons, cards and sheets (1.5rem–3rem), so xl and up
 * are 24–40; xs–lg stay small for icons, chips and inner elements.
 */
export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 24,
  '2xl': 28,
  '3xl': 36,
  full: 9999,
} as const;

/** Soft elevation, client brief: rgba(0,0,0,0.08), e.g. 0 8px 24px. Larger sizes only spread further. */
export const shadow = {
  xs: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
  },
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
  xl: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 12,
  },
  '2xl': {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.08,
    shadowRadius: 48,
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
