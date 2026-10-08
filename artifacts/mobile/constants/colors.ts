/**
 * Semantic color tokens — mirrors the Sleek `:root` block in sleek-temp-ref/globals.css.
 * Crimson primary + emerald accent on a cool slate background.
 */
export const colors = {
  background: '#F8FAFC',
  foreground: '#0B0F19',
  primary: '#C91A25',
  primaryForeground: '#FFFFFF',
  secondary: '#F1F5F9',
  secondaryForeground: '#0F172A',
  muted: '#E2E8F0',
  mutedForeground: '#64748B',
  accent: '#10B981',
  accentForeground: '#FFFFFF',
  destructive: '#C91A25',
  destructiveForeground: '#FFFFFF',
  card: '#FFFFFF',
  cardForeground: '#0B0F19',
  border: '#E2E8F0',
  input: '#F1F5F9',
  ring: '#C91A25',
  chart1: '#C91A25',
  chart2: '#475569',
  chart3: '#D97706',
  chart4: '#2563EB',
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
