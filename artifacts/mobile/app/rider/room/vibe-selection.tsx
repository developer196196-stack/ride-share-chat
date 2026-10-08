/** Sleek 9 — Vibe Selection (home tab). Live R.O.O.M. counts per vibe; joining needs VERIFIED. */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getGetAuthMeQueryKey,
  getListVibesQueryKey,
  useGetAuthMe,
  useJoinRoom,
  useListVibes,
  type Vibe,
  type VibeStats,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow, tintedShadow } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { VIBE_OPTIONS, vibeOption, vibeForRideStyle } from '@/constants/vibes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Card, ErrorBanner, Icon, Screen } from '@/components/ui';
import { BottomTabBar, LogoTile } from '@/components/rideshare';
import { SafetyFab } from '@/components/safety/SafetyFab';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useAuthStore } from '@/stores/auth.store';
import { useTripStore } from '@/stores/trip.store';

function roomsLabel(stats: VibeStats | undefined): string {
  if (!stats) return '—';
  if (stats.rooms === 0) return 'New room';
  return `${stats.rooms} room${stats.rooms === 1 ? '' : 's'}`;
}

function waitLabel(stats: VibeStats | undefined): string {
  if (!stats || stats.rooms === 0) return 'Opens now';
  return stats.openSeats > 0 ? 'Instant seat' : 'Opening a room';
}

export default function VibeSelectionScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const state = useTripStore((s) => s.snapshot?.state);
  const me = useGetAuthMe({ query: { queryKey: getGetAuthMeQueryKey(), enabled: isAuthenticated } });
  const vibes = useListVibes({ query: { queryKey: getListVibesQueryKey(), enabled: isAuthenticated, refetchInterval: 10_000 } });
  const join = useJoinRoom();
  const [selected, setSelected] = useState<Vibe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = new Map((vibes.data ?? []).map((v) => [v.vibe, v]));
  const recommended = vibeForRideStyle(me.data?.rideStyle);
  const current: Vibe = selected ?? recommended;
  const currentOption = vibeOption(current);
  const recommendedOption = vibeOption(recommended);
  const verified = state === 'VERIFIED';
  const totalRooms = (vibes.data ?? []).reduce((a, v) => a + v.rooms, 0);

  const enter = async () => {
    setError(null);
    try {
      const session = await join.mutateAsync({ data: { vibe: current } });
      useTripStore.getState().setRoom(session);
      router.push(routes.activeRoom);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not join a R.O.O.M.'));
    }
  };

  return (
    <View style={styles.root}>
      <Screen contentStyle={styles.content} edges={['top']} footer={<BottomTabBar active="home" />}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LogoTile size={56} padding={6} rounded="2xl" elevation="sm" />
            <View style={styles.headerText}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {me.data?.displayName ?? 'Rider'}
                </Text>
                <View style={[styles.onlineDot, !verified && { backgroundColor: colors.chart3 }]} />
              </View>
              <Text style={styles.subtitle} numberOfLines={1}>
                {me.data?.homeCity ? `${me.data.homeCity} · ` : ''}
                {verified ? 'In transit' : 'Not verified yet'}
              </Text>
            </View>
          </View>
          <View style={[styles.verified, !verified && styles.notVerified]}>
            <Icon name="solarShieldCheckBold" size={14} color={verified ? colors.primary : colors.chart3} />
            <Text style={[styles.verifiedText, !verified && { color: colors.chart3 }]}>
              {verified ? 'Verified' : 'Pending'}
            </Text>
          </View>
        </View>

        <LinearGradient
          colors={[withAlpha(colors.primary, 0.1), withAlpha(colors.primary, 0.05), colors.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.recommended}
        >
          <View style={styles.recommendedText}>
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedBadgeText}>Recommended Room</Text>
            </View>
            <Text style={styles.recommendedTitle}>{recommendedOption.headline}</Text>
            <Text style={styles.recommendedBody}>
              {stats.get(recommended)?.riders
                ? `${stats.get(recommended)!.riders} verified riders in transit right now.`
                : 'Matches your ride style — be the first in a new R.O.O.M.'}
            </Text>
          </View>
          <Pressable style={styles.fireIcon} onPress={() => setSelected(recommended)} accessibilityLabel="Pick recommended vibe">
            <Icon name="solarFireBold" size={18} color={colors.primaryForeground} />
          </Pressable>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Choose your vibe</Text>
          <Text style={styles.sectionMeta}>{totalRooms} Rolling R.O.O.M.s</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel} contentContainerStyle={styles.carouselContent}>
          {VIBE_OPTIONS.map((v) => {
            const active = v.value === current;
            const s = stats.get(v.value);
            return (
              <Pressable key={v.value} onPress={() => setSelected(v.value)} style={[styles.vibeCard, active && styles.vibeCardActive]}>
                <View style={[styles.vibeIcon, active && styles.vibeIconActive]}>
                  <Icon name={v.icon} size={24} color={active ? colors.primaryForeground : colors.foreground} />
                </View>
                <View style={styles.vibeTitleRow}>
                  <Text style={styles.vibeTitle}>{v.label}</Text>
                  <Text style={[styles.vibeRooms, active && styles.vibeRoomsActive]}>{roomsLabel(s)}</Text>
                </View>
                <Text style={styles.vibeDescription}>{v.description}</Text>
                <View style={styles.vibeFooter}>
                  <Text style={[styles.vibeTag, active && styles.vibeTagActive]}>{v.tag}</Text>
                  <Text style={styles.vibeWait}>{waitLabel(s)}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <Card style={styles.selection}>
          <View style={styles.selectionHeader}>
            <View style={styles.selectionLeft}>
              <View style={styles.onlineDot} />
              <Text style={styles.selectionTitle}>Selected: {currentOption.label}</Text>
            </View>
            <Text style={styles.selectionMeta}>{stats.get(current)?.riders ?? 0} riding now</Text>
          </View>
          <Text style={styles.selectionBody}>
            Rolling R.O.O.M.s seat up to 10 verified riders and backfill as people reach their drop-off.
          </Text>
        </Card>

        {!verified ? (
          <ErrorBanner
            tone="warning"
            style={styles.banner}
            message="Your ride must be VERIFIED before you can enter a R.O.O.M. Keep Trip Validation running."
          />
        ) : null}
        {error ? <ErrorBanner message={error} style={styles.banner} /> : null}

        {verified ? (
          <Button
            label="Join Rolling R.O.O.M."
            icon="solarUsersGroupTwoRoundedBold"
            iconSize={20}
            iconPosition="left"
            height={52}
            borderRadius={radius.xl}
            style={styles.cta}
            loading={join.isPending}
            onPress={enter}
          />
        ) : (
          <Button
            label="Back to Trip Validation"
            variant="outline"
            icon="solarRouteLinear"
            iconSize={18}
            iconPosition="left"
            height={52}
            borderRadius={radius.xl}
            size="sm"
            style={styles.cta}
            onPress={() => router.push(routes.validation)}
          />
        )}
      </Screen>
      <SafetyFab style={styles.fab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fab: { bottom: 96 },
  banner: { marginTop: 12 },
  headerText: { flexShrink: 1 },
  notVerified: { borderColor: withAlpha(colors.chart3, 0.3), backgroundColor: withAlpha(colors.chart3, 0.1) },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 112,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    ...textSize.base,
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  subtitle: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0.2),
    backgroundColor: withAlpha(colors.primary, 0.1),
  },
  verifiedText: {
    ...textSize.xs,
    fontFamily: fonts.sans.semibold,
    color: colors.primary,
  },
  recommended: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0.2),
    padding: 16,
    marginBottom: 20,
  },
  recommendedText: {
    flex: 1,
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recommendedBadgeText: {
    ...textSize['10'],
    fontFamily: fonts.sans.bold,
    color: colors.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(10),
  },
  recommendedTitle: {
    ...textSize.lg,
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    marginTop: 8,
  },
  recommendedBody: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  fireIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...tintedShadow(colors.primary, 0.3, 'md'),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    ...textSize['2xl'],
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    letterSpacing: tracking.tight(24),
  },
  sectionMeta: {
    ...textSize.xs,
    fontFamily: fonts.sans.semibold,
    color: colors.primary,
  },
  carousel: {
    marginHorizontal: -20,
  },
  carouselContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 16,
  },
  vibeCard: {
    width: 256,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 20,
  },
  vibeCardActive: {
    borderWidth: 2,
    borderColor: colors.primary,
    ...tintedShadow(colors.primary, 0.1, 'md'),
  },
  vibeIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  vibeIconActive: {
    backgroundColor: colors.primary,
    ...shadow.sm,
  },
  vibeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  vibeTitle: {
    ...textSize.lg,
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
  },
  vibeRooms: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  vibeRoomsActive: {
    fontFamily: fonts.sans.semibold,
    color: colors.accent,
  },
  vibeDescription: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  vibeFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vibeTag: {
    ...textSize['11'],
    fontFamily: fonts.sans.medium,
    color: colors.mutedForeground,
  },
  vibeTagActive: {
    fontFamily: fonts.sans.semibold,
    color: colors.primary,
  },
  vibeWait: {
    ...textSize['11'],
    fontFamily: fonts.sans.medium,
    color: colors.mutedForeground,
  },
  selection: {
    marginTop: 4,
    padding: 16,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectionTitle: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
  },
  selectionMeta: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  selectionBody: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  cta: {
    marginTop: 16,
  },
});
