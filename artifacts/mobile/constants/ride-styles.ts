import type { RideStyle } from '@workspace/api-client-react';
import { colors } from './colors';
import type { IconName } from './icons';

/** Ride-style options for Profile Setup — values match OpenAPI `RideStyle`. */
export const RIDE_STYLES: { value: RideStyle; label: string; icon: IconName; tint: string }[] = [
  { value: 'party_tech', label: 'Party & Tech', icon: 'solarCupMusicBold', tint: colors.accent },
  { value: 'networking', label: 'Networking', icon: 'mdiBriefcase', tint: colors.chart4 },
  { value: 'deep_talks', label: 'Deep Talks', icon: 'solarMoonStarsBold', tint: colors.primary },
  { value: 'just_chilling', label: 'Just Chilling', icon: 'solarSofa2Bold', tint: colors.chart3 },
];

export function rideStyleOption(value: RideStyle | null | undefined) {
  return RIDE_STYLES.find((s) => s.value === value) ?? RIDE_STYLES[0];
}
