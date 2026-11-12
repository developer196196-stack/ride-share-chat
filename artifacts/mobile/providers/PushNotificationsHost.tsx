import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { routes } from '@/constants/routes';
import { getOnboardingFlags } from '@/lib/onboarding';
import {
  configureNotifications,
  getNotificationPermission,
  Notifications as MaybeNotifications,
  pushDataOf,
  registerForPush,
  requestNotificationPermission,
  type PushData,
} from '@/lib/notifications/push';
import { useAuthStore } from '@/stores/auth.store';
import { useTripStore } from '@/stores/trip.store';

configureNotifications();

/** Only rendered when `pushAvailable` (see app/_layout.tsx). */
const Notifications = MaybeNotifications!;

/**
 * Registers this device for push once the rider is signed in, and opens the right place when a
 * notification is tapped (also when the tap launched the app).
 */
export function PushNotificationsHost() {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  // Register on sign-in. Riders who finished onboarding before push existed are asked once here;
  // new riders are asked on the Permissions screen.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      let permission = await getNotificationPermission();
      if (permission === 'undetermined' && (await getOnboardingFlags()).permissionsDone && !cancelled) {
        permission = (await requestNotificationPermission()) ? 'granted' : 'denied';
      }
      if (permission === 'granted' && !cancelled) await registerForPush();
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, uid]);

  // New token (rare), or notifications switched on in system Settings while the app was away.
  useEffect(() => {
    if (!isAuthenticated) return;
    const tokenSub = Notifications.addPushTokenListener(() => void registerForPush());
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void registerForPush();
    });
    return () => {
      tokenSub.remove();
      appSub.remove();
    };
  }, [isAuthenticated]);

  // Taps: wait until the rider is signed in and past the launch/onboarding screens.
  const ready = isAuthenticated && (pathname.startsWith('/rider/room') || pathname.startsWith('/rider/account'));
  useEffect(() => {
    if (!ready || !lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = lastResponse.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const data = pushDataOf(lastResponse);
    if (data) open(data);
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);

    function open(data: PushData) {
      const store = useTripStore.getState();
      switch (data.type) {
        case 'room_invite':
          // The app-wide invite prompt takes it from here (Join / Not now).
          if (new Date(data.invite.expiresAt).getTime() > Date.now() && store.room?.roomId !== data.invite.roomId) {
            store.setInvite(data.invite);
          } else if (store.room?.roomId !== data.invite.roomId) {
            store.setNotice({ message: 'That invite has expired.', tone: 'warning' });
          }
          return;
        case 'join_request':
          if (store.room?.roomId === data.roomId) {
            if (pathname !== routes.activeRoom) router.push(routes.activeRoom);
          } else {
            store.setNotice({ message: 'That request has expired.', tone: 'warning' });
          }
          return;
        case 'new_follower':
          router.push({ pathname: routes.network, params: { tab: 'followers' } });
          return;
        case 'friend_live':
          // Friends riding now are at the top of the Discovery Grid.
          if (pathname !== routes.discover) router.push(routes.discover);
          return;
      }
    }
  }, [ready, lastResponse, pathname, router]);

  return null;
}
