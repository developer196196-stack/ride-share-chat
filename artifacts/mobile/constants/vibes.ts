import type { RideStyle, Vibe } from '@workspace/api-client-react';
import type { IconName } from './icons';

/** R.O.O.M. vibes — values match OpenAPI `Vibe`. */
export const VIBE_OPTIONS: {
  value: Vibe;
  label: string;
  headline: string;
  icon: IconName;
  description: string;
  tag: string;
}[] = [
  {
    value: 'party_mode',
    label: 'Party Mode',
    headline: 'Party Mode & Late Night Hype',
    icon: 'solarCupMusicBold',
    description: 'Weekend vibes, music recommendations, and fun fast banter.',
    tag: '⚡ High Energy',
  },
  {
    value: 'networking',
    label: 'Networking',
    headline: 'Networking on the Move',
    icon: 'mdiBriefcase',
    description: 'Founders, creatives, and tech operators sharing ride-time ideas.',
    tag: '💼 Professional',
  },
  {
    value: 'deep_talks',
    label: 'Deep Talks',
    headline: 'Deep Talks for the Long Ride',
    icon: 'solarMoonStarsBold',
    description: 'Late-night musings, unfiltered advice, and meaningful dialogue.',
    tag: '🌌 Chill & real',
  },
  {
    value: 'just_chilling',
    label: 'Just Chilling',
    headline: 'Just Chilling, Zero Pressure',
    icon: 'solarSofa2Bold',
    description: 'Casual background presence with zero social pressure.',
    tag: '🎧 Low-key',
  },
];

export function vibeOption(value: Vibe | null | undefined) {
  return VIBE_OPTIONS.find((v) => v.value === value) ?? VIBE_OPTIONS[0]!;
}

const STYLE_TO_VIBE: Record<RideStyle, Vibe> = {
  party_tech: 'party_mode',
  networking: 'networking',
  deep_talks: 'deep_talks',
  just_chilling: 'just_chilling',
};

export function vibeForRideStyle(style: RideStyle | null | undefined): Vibe {
  return style ? STYLE_TO_VIBE[style] : 'party_mode';
}
