import AsyncStorage from '@react-native-async-storage/async-storage';
import { routes, type AppRoute } from '@/constants/routes';

const INTRO_KEY = 'rsc:onboarding:introSeen';
const PERMISSIONS_KEY = 'rsc:onboarding:permissionsDone';

export type OnboardingFlags = { introSeen: boolean; permissionsDone: boolean };

async function read(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === '1';
  } catch {
    return false;
  }
}

async function write(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, '1');
  } catch {
    // Worst case the rider sees the screen again next launch.
  }
}

/** One-time onboarding state. Survives sign-out; cleared by reinstalling or clearing app data. */
export async function getOnboardingFlags(): Promise<OnboardingFlags> {
  const [introSeen, permissionsDone] = await Promise.all([read(INTRO_KEY), read(PERMISSIONS_KEY)]);
  return { introSeen, permissionsDone };
}

export const markIntroSeen = () => write(INTRO_KEY);
export const markPermissionsDone = () => write(PERMISSIONS_KEY);

/**
 * Where a signed-in rider goes next: finish the profile, grant permissions once, then Home (the
 * Discovery Grid). Trip validation runs in the background there; only rooms need a verified ride.
 */
export function routeForSignedInRider(profileComplete: boolean, flags: OnboardingFlags): AppRoute {
  if (!profileComplete) return routes.profileSetup;
  return flags.permissionsDone ? routes.discover : routes.permissions;
}
