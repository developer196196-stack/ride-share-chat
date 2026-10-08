import type { TextStyle } from 'react-native';

/**
 * Font families loaded in app/_layout.tsx.
 * Sleek: --font-sans "DM Sans", --font-heading "Space Grotesk", --font-mono "JetBrains Mono".
 * Space Grotesk tops out at 700, so heading extrabold/black map to bold.
 */
export const fonts = {
  sans: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    semibold: 'DMSans_600SemiBold',
    bold: 'DMSans_700Bold',
    extrabold: 'DMSans_800ExtraBold',
    black: 'DMSans_900Black',
  },
  heading: {
    medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
  },
  mono: {
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
    bold: 'JetBrainsMono_700Bold',
    extrabold: 'JetBrainsMono_800ExtraBold',
  },
} as const;

/** Tailwind `text-*` sizes with their default line heights. */
export const textSize = {
  '9': { fontSize: 9, lineHeight: 13 },
  '10': { fontSize: 10, lineHeight: 14 },
  '11': { fontSize: 11, lineHeight: 15 },
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 32 },
  '3xl': { fontSize: 30, lineHeight: 36 },
  '5xl': { fontSize: 48, lineHeight: 48 },
} satisfies Record<string, TextStyle>;

/** Tailwind `tracking-*` expressed in px for a given font size. */
export const tracking = {
  tighter: (size: number) => size * -0.05,
  tight: (size: number) => size * -0.025,
  wide: (size: number) => size * 0.025,
  wider: (size: number) => size * 0.05,
  widest: (size: number) => size * 0.1,
  em: (size: number, em: number) => size * em,
};
