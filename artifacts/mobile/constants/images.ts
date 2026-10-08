/** Bundled Sleek assets (sleek-temp-ref/images) and the remote demo avatars used in the designs. */
export const images = {
  logoMark: require('@/assets/images/logo-mark.png'),
  logoFull: require('@/assets/images/logo-full.png'),
  onboardingRooms: require('@/assets/images/onboarding-rooms.jpeg'),
  onboardingTransit: require('@/assets/images/onboarding-transit.jpeg'),
} as const;

const portrait = (gender: 'men' | 'women', id: number) =>
  `https://randomuser.me/api/portraits/${gender}/${id}.jpg`;

export const avatars = {
  you: portrait('men', 32),
  maya: portrait('women', 44),
  lucas: portrait('men', 22),
  elena: portrait('women', 68),
  david: portrait('men', 85),
  zara: portrait('women', 12),
  devon: portrait('men', 45),
  sam: portrait('women', 90),
  leo: portrait('men', 62),
} as const;
