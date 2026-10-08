/**
 * App entry at `/`.
 * Normally redirects straight into the app (splash). In a dev build with
 * `EXPO_PUBLIC_SHOW_SLEEK_SCREENS=true` it shows the Sleek screen catalogue instead.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { colors, withAlpha } from '@/constants/colors';
import { MAX_CONTENT_WIDTH, radius, shadow } from '@/constants/layout';
import { fonts, textSize, tracking } from '@/constants/typography';
import { routes, type AppRoute } from '@/constants/routes';
import { Icon } from '@/components/ui';
import { LogoTile } from '@/components/rideshare';
import { env } from '@/lib/config/env';

type Entry = { no: number; title: string; route: AppRoute };

const SECTIONS: { title: string; subtitle: string; entries: Entry[] }[] = [
  {
    title: 'Onboarding',
    subtitle: 'Splash → intro → phone → profile → rideshare link → permissions',
    entries: [
      { no: 1, title: 'Splash Screen', route: routes.splash },
      { no: 2, title: 'Onboarding #1 — Meet While You Move', route: routes.welcome },
      { no: 3, title: 'Onboarding #2 — Verified Rides Only', route: routes.howItWorks },
      { no: 4, title: 'Authentication', route: routes.phoneAuth },
      { no: 5, title: 'Profile Setup', route: routes.profileSetup },
      { no: 6, title: 'Rideshare Connect', route: routes.rideshareConnect },
      { no: 7, title: 'Permissions', route: routes.permissions },
    ],
  },
  {
    title: 'Rolling Rooms',
    subtitle: 'Trip validation → vibe queue → live room → grace / fast-track → summary',
    entries: [
      { no: 8, title: 'Trip Validation', route: routes.validation },
      { no: 9, title: 'Vibe Selection', route: routes.vibeSelection },
      { no: 10, title: 'Active Room', route: routes.activeRoom },
      { no: 11, title: 'Disconnect Summary', route: routes.rideSummary },
      { no: 12, title: 'Traffic Grace Period', route: routes.trafficGrace },
      { no: 13, title: 'Fast-Track Matchmaking', route: routes.fastTrack },
    ],
  },
  {
    title: 'Account',
    subtitle: 'Connections, trip history, trust & settings',
    entries: [
      { no: 14, title: 'Connections & History', route: routes.connections },
      { no: 15, title: 'Settings & Trust Center', route: routes.settings },
    ],
  },
];

export default function AppEntry() {
  if (!env.showSleekScreens) {
    return <Redirect href={routes.splash} />;
  }
  return <ScreenCatalogue />;
}

function ScreenCatalogue() {
  const router = useRouter();
  const open = (route: AppRoute) => router.push(route as never);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.header}>
            <LogoTile size={56} padding={6} rounded="2xl" elevation="sm" />
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>Rideshare Chats</Text>
              <Text style={styles.title}>Sleek Screens</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Static build — tap a screen to preview it, or launch the full flow.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.launch, pressed && styles.pressed]}
            onPress={() => open(routes.splash)}
          >
            <View>
              <Text style={styles.launchTitle}>Launch app flow</Text>
              <Text style={styles.launchSubtitle}>Starts at the splash screen · 15 screens</Text>
            </View>
            <Icon name="solarArrowRightBold" size={20} color={colors.primaryForeground} />
          </Pressable>

          {SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              <View style={styles.list}>
                {section.entries.map((entry, i) => (
                  <Pressable
                    key={entry.no}
                    onPress={() => open(entry.route)}
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && styles.rowDivider,
                      pressed && { backgroundColor: colors.secondary },
                    ]}
                  >
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{entry.no}</Text>
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{entry.title}</Text>
                      <Text style={styles.rowRoute}>{entry.route}</Text>
                    </View>
                    <Icon name="solarAltArrowRightLinear" size={16} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  headerText: {
    gap: 2,
  },
  eyebrow: {
    ...textSize['11'],
    fontFamily: fonts.sans.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: tracking.widest(11),
  },
  title: {
    ...textSize['2xl'],
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    letterSpacing: tracking.tight(24),
  },
  subtitle: {
    ...textSize.sm,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  launch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    ...shadow.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
  },
  pressed: {
    opacity: 0.92,
  },
  launchTitle: {
    ...textSize.base,
    fontFamily: fonts.sans.extrabold,
    color: colors.primaryForeground,
  },
  launchSubtitle: {
    ...textSize.xs,
    fontFamily: fonts.sans.medium,
    color: withAlpha(colors.white, 0.8),
  },
  section: {
    gap: 4,
    marginTop: 8,
  },
  sectionTitle: {
    ...textSize.xs,
    fontFamily: fonts.heading.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(12),
  },
  sectionSubtitle: {
    ...textSize['11'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    marginBottom: 6,
  },
  list: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...shadow.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...textSize.xs,
    fontFamily: fonts.mono.bold,
    color: colors.primary,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    ...textSize.sm,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
  },
  rowRoute: {
    ...textSize['10'],
    fontFamily: fonts.mono.regular,
    color: colors.mutedForeground,
  },
});
