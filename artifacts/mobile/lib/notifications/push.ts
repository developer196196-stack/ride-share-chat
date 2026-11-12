/**
 * Push notifications (Expo push service: FCM on Android, APNs on iOS). The API stores this
 * device's Expo push token and sends notifications for new followers, room invites, join
 * requests and friends opening a R.O.O.M. Taps are routed by `PushNotificationsHost`.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { registerPushToken, removePushToken } from '@workspace/api-client-react';
import { colors } from '@/constants/colors';
import type { RoomInvitePayload } from '@/lib/realtime/events';
import { useTripStore } from '@/stores/trip.store';

/** `data` the API puts on each notification (artifacts/api-nest/src/notifications/push.service.ts). */
export type PushData =
  | { type: 'room_invite'; invite: RoomInvitePayload }
  | { type: 'join_request'; roomId: string; uid: string }
  | { type: 'new_follower'; uid: string }
  | { type: 'friend_live'; uid: string };

/** Shown in the app by the realtime socket already, so no banner while the app is open and connected. */
const IN_APP: ReadonlySet<string> = new Set(['room_invite', 'join_request']);

/**
 * False in builds made before expo-notifications was added (the JS would crash loading it), on web
 * and in Expo Go. The app then simply runs without push until the next build.
 */
export const pushAvailable =
  (Platform.OS === 'ios' || Platform.OS === 'android') && requireOptionalNativeModule('ExpoPushTokenManager') != null;

/** Loaded only when the native module exists. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const Notifications: typeof NotificationsModule | null = pushAvailable ? require('expo-notifications') : null;

let configured = false;

/** Foreground behaviour and Android channels. Safe to call more than once. */
export function configureNotifications(): void {
  if (!Notifications || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const type = notification.request.content.data?.type;
      const show = !(typeof type === 'string' && IN_APP.has(type) && useTripStore.getState().connected);
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('rooms', {
      name: 'R.O.O.M. invites & requests',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: colors.primary,
    }).catch(() => undefined);
    void Notifications.setNotificationChannelAsync('social', {
      name: 'Friends & followers',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => undefined);
  }
}

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!Notifications) return 'unsupported';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** Shows the OS prompt (once; after that the rider has to use system Settings). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    configureNotifications();
    const p = await Notifications.requestPermissionsAsync();
    return p.granted;
  } catch {
    return false;
  }
}

let registeredToken: string | null = null;

/** Sends this device's push token to the API (signed in, permission granted, real device). */
export async function registerForPush(): Promise<string | null> {
  if (!Notifications || !Device.isDevice) return null;
  if ((await getNotificationPermission()) !== 'granted') return null;
  try {
    configureNotifications();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await registerPushToken({ token, platform: Platform.OS as 'ios' | 'android' });
    registeredToken = token;
    return token;
  } catch (err) {
    // Android without google-services.json (Firebase) can't get a token; the app works without push.
    if (__DEV__) console.warn('[push] registration failed', err);
    return null;
  }
}

/** Before signing out: stop notifications for this rider on this device. */
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  await removePushToken({ token }).catch(() => undefined);
}

export function pushDataOf(response: NotificationsModule.NotificationResponse): PushData | null {
  const data = response.notification.request.content.data as Partial<PushData> | undefined;
  return data && typeof data.type === 'string' ? (data as PushData) : null;
}
