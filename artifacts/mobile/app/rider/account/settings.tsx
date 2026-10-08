/** Sleek 15 — Settings & Trust Center (settings tab). */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAuthMeQueryKey,
  getGetPreferencesQueryKey,
  getListTrustedContactsQueryKey,
  useGetAuthMe,
  useGetPreferences,
  useListTrustedContacts,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import type { IconName } from '@/constants/icons';
import { languageLabel } from '@/constants/languages';
import { radius } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Card, Divider, Icon, IconButton, Screen } from '@/components/ui';
import { BottomTabBar } from '@/components/rideshare';
import { useAuthStore } from '@/stores/auth.store';
import { useTripStore } from '@/stores/trip.store';

function SettingsRow({
  icon,
  title,
  caption,
  onPress,
}: {
  icon: IconName;
  title: string;
  caption: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingCaption}>{caption}</Text>
      </View>
      {onPress ? <Icon name="solarAltArrowRightLinear" size={16} color={colors.mutedForeground} /> : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signOut = useAuthStore((s) => s.signOut);
  const me = useGetAuthMe({ query: { queryKey: getGetAuthMeQueryKey(), enabled: isAuthenticated } });
  const prefs = useGetPreferences({ query: { queryKey: getGetPreferencesQueryKey(), enabled: isAuthenticated } });
  const contacts = useListTrustedContacts({ query: { queryKey: getListTrustedContactsQueryKey(), enabled: isAuthenticated } });

  const logout = async () => {
    useTripStore.getState().reset();
    await signOut();
    queryClient.clear();
    router.replace(routes.phoneAuth);
  };

  const profile = me.data;
  const contactCount = contacts.data?.length ?? 0;

  return (
    <Screen spaceBetween contentStyle={styles.content} edges={['top']} footer={<BottomTabBar active="settings" />}>
      <View style={styles.main}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton
              icon="solarArrowLeftLinear"
              shape="rounded"
              color={colors.foreground}
              onPress={() => (router.canGoBack() ? router.back() : router.replace(routes.vibeSelection))}
            />
            <View>
              <Text style={styles.title}>Trust & Settings</Text>
              <Text style={styles.subtitle}>Privacy, safety & translation</Text>
            </View>
          </View>
          {profile?.phoneNumber ? (
            <View style={styles.verifiedPill}>
              <Text style={styles.verifiedText}>Verified User</Text>
            </View>
          ) : null}
        </View>

        <Card rounded="3xl" style={styles.profile}>
          {profile?.photoUrl ? (
            <Image source={{ uri: profile.photoUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Icon name="solarUserCircleLinear" size={28} color={colors.mutedForeground} />
            </View>
          )}
          <View style={styles.profileText}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile?.displayName ?? 'Your profile'}
              </Text>
              {profile?.phoneNumber ? <Icon name="solarVerifiedCheckBold" size={16} color={colors.accent} /> : null}
            </View>
            <Text style={styles.profileMeta} numberOfLines={1}>
              {profile?.homeCity ?? 'Add your home city'}
            </Text>
            {profile?.phoneNumber ? (
              <View style={styles.liveness}>
                <View style={styles.livenessDot} />
                <Text style={styles.livenessText}>Phone verified · {profile.phoneNumber}</Text>
              </View>
            ) : null}
          </View>
          <Pressable style={styles.editButton} onPress={() => router.push(routes.profileSetup)}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <Card style={styles.group}>
            <SettingsRow
              icon="solarWidget2Linear"
              title="Language & Translation"
              caption={
                prefs.data
                  ? `${languageLabel(prefs.data.nativeLanguage)} · auto-translate ${prefs.data.autoTranslate ? 'on' : 'off'}`
                  : 'Native language, translation, subtitles'
              }
              onPress={() => router.push(routes.languageSettings)}
            />
            <Divider />
            <SettingsRow
              icon="solarShieldCheckBold"
              title="Safety & Trusted Contacts"
              caption={contactCount > 0 ? `${contactCount} trusted contact${contactCount === 1 ? '' : 's'}` : 'Add people for live trip sharing'}
              onPress={() => router.push(routes.safetyContacts)}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Transit Shields</Text>
          <Card style={styles.group}>
            <SettingsRow
              icon="solarEyeClosedBold"
              title="Incognito Drop-off Shield"
              caption={profile?.incognitoDropoff === false ? 'Off · change in your profile' : 'On · regional metro only, never exact addresses'}
              onPress={() => router.push(routes.profileSetup)}
            />
            <Divider />
            <SettingsRow
              icon="solarLockKeyholeLinear"
              title="Phone number stays private"
              caption="Never shown to other riders or in video sessions"
            />
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety & Moderation</Text>
          <Card style={styles.group}>
            <SettingsRow
              icon="solarForwardBold"
              title="Skipped riders are blocked for 60 minutes"
              caption="Anyone you leave with Next won't be matched with you again for an hour"
            />
            <Divider />
            <SettingsRow
              icon="solarHistoryLinear"
              title="Ride history"
              caption="Your validated rides and R.O.O.M. stats"
              onPress={() => router.push(routes.connections)}
            />
          </Card>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label={isAuthenticated ? 'Log Out & Clear Local Telemetry' : 'Sign In'}
          variant={isAuthenticated ? 'destructiveSoft' : 'primary'}
          height={44}
          borderRadius={radius.xl}
          size="xs"
          style={styles.logout}
          onPress={() => (isAuthenticated ? void logout() : router.replace(routes.phoneAuth))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { backgroundColor: colors.secondary },
  rowIcon: { width: 32, height: 32, borderRadius: radius.lg, backgroundColor: withAlpha(colors.primary, 0.08), alignItems: 'center', justifyContent: 'center' },
  avatarEmpty: { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  content: {
    padding: 20,
    paddingBottom: 112,
  },
  main: {
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  title: {
    ...textSize.lg,
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
  },
  subtitle: {
    ...textSize['11'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  verifiedPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.accent, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.2),
  },
  verifiedText: {
    ...textSize['10'],
    fontFamily: fonts.sans.bold,
    color: colors.accent,
  },
  profile: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: colors.primary,
  },
  profileText: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileName: {
    ...textSize.sm,
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
  },
  profileMeta: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  liveness: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  livenessDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  livenessText: {
    ...textSize['10'],
    fontFamily: fonts.sans.semibold,
    color: colors.accent,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.xl,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editText: {
    ...textSize.xs,
    fontFamily: fonts.sans.semibold,
    color: colors.foreground,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    ...textSize.xs,
    fontFamily: fonts.heading.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(12),
  },
  group: {
    padding: 14,
    gap: 14,
  },
  groupTight: {
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingText: {
    flex: 1,
    maxWidth: 240,
    gap: 2,
  },
  settingTitle: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
  },
  settingCaption: {
    ...textSize['11'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: colors.mutedForeground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  providerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  providerLogo: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerLogoText: {
    fontSize: 9,
    lineHeight: 12,
    fontFamily: fonts.sans.black,
    color: colors.white,
  },
  tokenText: {
    ...textSize['10'],
    fontFamily: fonts.sans.medium,
    color: colors.accent,
  },
  revoke: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: withAlpha(colors.destructive, 0.3),
    backgroundColor: withAlpha(colors.destructive, 0.1),
  },
  revokeText: {
    ...textSize['10'],
    fontFamily: fonts.sans.bold,
    color: colors.destructive,
  },
  footer: {
    paddingTop: 12,
  },
  logout: {
    shadowOpacity: 0,
    elevation: 0,
  },
});
