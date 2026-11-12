/**
 * Semantic color tokens — client brand brief (Oct 2026): pure white surfaces, Racing Red primary,
 * Trust Blue for navigation and secondary actions, Emerald for verified/success, Amber for warnings,
 * Midnight Navy text. Light only; no dark mode.
 */
export const colors = {
  background: '#FFFFFF',
  foreground: '#0F172A',
  /** Racing Red: primary buttons, brand elements, urgent actions. */
  primary: '#E32424',
  primaryForeground: '#FFFFFF',
  /** Faint Trust Blue tint for secondary surfaces (chips, tiles) instead of slate grey. */
  secondary: '#F4F6FF',
  /** Secondary / ghost button text. */
  secondaryForeground: '#4A69FF',
  muted: '#EEF1F6',
  mutedForeground: '#475569',
  /** Emerald: verified and security badges, online states, success. */
  accent: '#10B981',
  accentForeground: '#FFFFFF',
  destructive: '#E32424',
  destructiveForeground: '#FFFFFF',
  card: '#FFFFFF',
  cardForeground: '#0F172A',
  border: '#EDF0F5',
  input: '#F5F7FB',
  ring: '#E32424',
  /** Trust Blue: navigation, headers, reliability indicators, secondary buttons. */
  trust: '#4A69FF',
  trustForeground: '#FFFFFF',
  /** Amber: ratings, match scores, warnings. */
  warning: '#F59E0B',
  chart1: '#E32424',
  chart2: '#475569',
  chart3: '#F59E0B',
  chart4: '#4A69FF',
  chart5: '#10B981',

  // Fixed palette values used by specific Sleek screens
  white: '#FFFFFF',
  black: '#000000',
  amber400: '#FBBF24',
  blue500: '#3B82F6',
  slate400: '#94A3B8',
  pink600: '#DB2777',
  lyft: '#FF00BF',
} as const;

export type ColorToken = keyof typeof colors;

/** `bg-primary/10` style alpha variant of a hex token. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
