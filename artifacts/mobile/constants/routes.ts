/** Expo Router paths for every Sleek screen (see screens.json). */
export const routes = {
  splash: '/rider/onboarding/splash',
  welcome: '/rider/onboarding/welcome',
  howItWorks: '/rider/onboarding/how-it-works',
  phoneAuth: '/rider/onboarding/phone-auth',
  profileSetup: '/rider/onboarding/profile-setup',
  rideshareConnect: '/rider/onboarding/rideshare-connect',
  permissions: '/rider/onboarding/permissions',
  validation: '/rider/room/validation',
  vibeSelection: '/rider/room/vibe-selection',
  activeRoom: '/rider/room/active-room',
  rideSummary: '/rider/room/ride-summary',
  trafficGrace: '/rider/room/traffic-grace',
  fastTrack: '/rider/room/fast-track',
  connections: '/rider/account/connections',
  settings: '/rider/account/settings',
  languageSettings: '/rider/account/language',
  safetyContacts: '/rider/account/safety-contacts',
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
