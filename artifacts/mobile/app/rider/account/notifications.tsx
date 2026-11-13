/** Notifications: which push notifications this rider gets, and whether the phone allows them. */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPreferencesQueryKey,
  useGetPreferences,
  useUpdatePreferences,
  type Preferences,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Card, ErrorBanner, Icon, Screen, Toggle } from '@/components/ui';
import { AccountHeader } from '@/components/rideshare/AccountHeader';
import { SignInRequired } from '@/components/rideshare/SignInRequired';
import { getApiErrorMessage } from '@/lib/api/error-message';
import {
  getNotificationPermission,
  registerForPush,
  requestNotificationPermission,
  type NotificationPermission,
} from '@/lib/notifications/push';
import { useAuthStore } from '@/stores/auth.store';

type NotifyKey = 'notifyRoomInvites' | 'notifyNewFollowers' | 'notifyFriendsLive';

const KINDS: { key: NotifyKey; title: string; caption: string }[] = [
  {
    key: 'notifyRoomInvites',
    title: 'Room invites & requests',
    caption: 'A host invites you, accepts your request, or a friend asks to join your R.O.O.M.',
  },
  { key: 'notifyFriendsLive', title: 'Friends riding now', caption: 'A friend opens a R.O.O.M. (at most once an hour per friend)' },
  { key: 'notifyNewFollowers', title: 'New followers', caption: 'Someone follows you or follows you back' },
];

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const prefs = useGetPreferences({ query: { queryKey: getGetPreferencesQueryKey(), enabled: isAuthenticated } });
  const update = useUpdatePreferences();
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getNotificationPermission().then(setPermission);
  }, []);

  useEffect(() => {
    refresh();
    // Back from system Settings.
    const sub = AppState.addEventListener('change', (next) => next === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const turnOn = async () => {
    if (permission === 'undetermined') {
      if (await requestNotificationPermission()) void registerForPush();
      refresh();
    } else {
      void Linking.openSettings();
    }
  };

  // Saves straight away; the switch flips immediately and rolls back if saving fails.
  const set = async (key: NotifyKey, value: boolean) => {
    const current = prefs.data;
    if (!current) return;
    setError(null);
    const next: Preferences = { ...current, [key]: value };
    queryClient.setQueryData(getGetPreferencesQueryKey(), next);
    try {
      queryClient.setQueryData(getGetPreferencesQueryKey(), await update.mutateAsync({ data: next }));
    } catch (err) {
      queryClient.setQueryData(getGetPreferencesQueryKey(), current);
      setError(getApiErrorMessage(err, 'Could not save your notification settings.'));
    }
  };

  const blocked = permission === 'denied' || permission === 'undetermined';

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.main}>
        <AccountHeader title="Notifications" subtitle="What we let you know about when the app is closed" />

        {isAuthReady && !isAuthenticated ? (
          <SignInRequired message="Sign in to choose your notifications." />
        ) : (
          <>
            {blocked ? (
              <Card style={styles.banner}>
                <View style={styles.bannerIcon}>
                  <Icon name="mdiBell" size={20} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Notifications are off on this phone</Text>
                  <Text style={styles.rowCaption}>
                    {permission === 'denied'
                      ? 'Turn them on in your phone’s Settings to hear about invites while the app is closed.'
                      : 'Allow notifications to hear about invites while the app is closed.'}
                  </Text>
                </View>
                <Button
                  label={permission === 'denied' ? 'Settings' : 'Turn on'}
                  size="xs"
                  height={34}
                  borderRadius={radius.lg}
                  onPress={() => void turnOn()}
                />
              </Card>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Send me a notification for</Text>
              {!prefs.data ? (
                prefs.error ? (
                  <ErrorBanner message={getApiErrorMessage(prefs.error, 'Could not load your settings.')} />
                ) : (
                  <ActivityIndicator color={colors.primary} style={styles.loading} />
                )
              ) : (
                KINDS.map((kind) => (
                  <Card key={kind.key} style={[styles.row, blocked && styles.dimmed]}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{kind.title}</Text>
                      <Text style={styles.rowCaption}>{kind.caption}</Text>
                    </View>
                    <Toggle
                      value={prefs.data[kind.key] !== false}
                      onValueChange={(v) => void set(kind.key, v)}
                      accessibilityLabel={kind.title}
                    />
                  </Card>
                ))
              )}
            </View>

            {error ? <ErrorBanner message={error} /> : null}

            <Text style={styles.note}>
              Safety alerts to your trusted contacts are sent by text or email and aren’t affected by these settings.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  main: { gap: 20 },
  loading: { marginTop: 24 },
  section: { gap: 8 },
  sectionTitle: {
    ...textSize.xs,
    fontFamily: fonts.heading.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(12),
  },
  banner: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderColor: withAlpha(colors.primary, 0.3),
    backgroundColor: withAlpha(colors.primary, 0.05),
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dimmed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...textSize.sm, fontFamily: fonts.sans.bold, color: colors.foreground },
  rowCaption: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  note: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground, textAlign: 'center' },
});
