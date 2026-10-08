/** Sleek 14 — Connections & History (history tab). Real validated-ride history. */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getListRidesQueryKey, useListRides, type RideSummary } from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { vibeOption } from '@/constants/vibes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Card, ErrorBanner, Icon, IconButton, Screen } from '@/components/ui';
import { BottomTabBar } from '@/components/rideshare';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useAuthStore } from '@/stores/auth.store';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `Today at ${time}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
}

export default function ConnectionsScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const rides = useListRides({ query: { queryKey: getListRidesQueryKey(), enabled: isAuthenticated } });
  const list: RideSummary[] = rides.data ?? [];

  const peers = list.reduce((a, r) => a + r.peersMet, 0);
  const miles = Math.round(list.reduce((a, r) => a + r.distanceMiles, 0) * 10) / 10;
  const stats = [
    { value: String(peers), label: 'Peers Met', color: colors.primary },
    { value: `${miles} mi`, label: 'Transit Logs', color: colors.foreground },
    { value: String(list.length), label: 'Validated Rides', color: colors.accent },
  ];

  return (
    <Screen spaceBetween contentStyle={styles.content} edges={['top']} footer={<BottomTabBar active="history" />}>
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
              <Text style={styles.title}>Connections & Trips</Text>
              <Text style={styles.subtitle}>Your verified in-transit network</Text>
            </View>
          </View>
        </View>

        <View style={styles.stats}>
          {stats.map((s) => (
            <Card key={s.label} style={styles.stat}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </Card>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mutual Peer Requests</Text>
          </View>
          <Card style={styles.request}>
            <View style={styles.requestLeft}>
              <View style={styles.rideIcon}>
                <Icon name="solarUsersGroupRoundedBold" size={16} color={colors.primary} />
              </View>
              <View style={styles.requestText}>
                <Text style={styles.requestName}>Peer connections are coming soon</Text>
                <Text style={styles.requestMeta}>You'll be able to reconnect with riders you met in R.O.O.M.s.</Text>
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past Validated Rides</Text>
          {rides.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {rides.error ? <ErrorBanner message={getApiErrorMessage(rides.error, 'Could not load your rides.')} /> : null}
          {!rides.isLoading && !rides.error && list.length === 0 ? (
            <Text style={styles.requestMeta}>No validated rides yet. Your first ride will show up here.</Text>
          ) : null}
          {list.map((ride) => (
            <Card key={ride.rideId} style={styles.ride}>
              <View style={styles.rideRow}>
                <View style={styles.rideLeft}>
                  <View style={styles.rideIcon}>
                    <Icon name="solarCarBold" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.requestText}>
                    <Text style={styles.requestName}>{ride.vibe ? `${vibeOption(ride.vibe).label} ride` : 'Validated ride'}</Text>
                    <Text style={styles.requestMeta}>
                      {formatWhen(ride.startedAt)} · {ride.distanceMiles} miles
                    </Text>
                  </View>
                </View>
                <Text style={styles.rideDuration}>{formatDuration(ride.durationSec)}</Text>
              </View>
              <View style={styles.rideFooter}>
                <Text style={styles.rideFooterText}>
                  {ride.peersMet} participant{ride.peersMet === 1 ? '' : 's'} met
                </Text>
                <Text style={styles.rideVerified}>
                  {ride.graceCount > 0 ? `${ride.graceCount} grace stop${ride.graceCount === 1 ? '' : 's'}` : 'Speed verified'}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label="Start New In-Transit Match"
          icon="solarCarLinear"
          iconPosition="left"
          height={48}
          borderRadius={radius.xl}
          size="xs"
          onPress={() => router.push(routes.validation)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    ...textSize.lg,
    fontFamily: fonts.heading.bold,
  },
  statLabel: {
    ...textSize['10'],
    fontFamily: fonts.sans.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(10),
    textAlign: 'center',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...textSize.xs,
    fontFamily: fonts.heading.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(12),
  },
  sectionAction: {
    ...textSize['11'],
    fontFamily: fonts.sans.bold,
    color: colors.primary,
  },
  requests: {
    gap: 8,
  },
  request: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  requestLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestText: {
    flexShrink: 1,
  },
  requestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requestName: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
  },
  regionTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.xs,
    backgroundColor: colors.secondary,
  },
  regionText: {
    ...textSize['10'],
    fontFamily: fonts.sans.medium,
    color: colors.mutedForeground,
  },
  requestMeta: {
    ...textSize['10'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 6,
  },
  accept: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.xs,
  },
  decline: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ride: {
    padding: 12,
    gap: 10,
  },
  rideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  rideIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: withAlpha(colors.accent, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideDuration: {
    ...textSize.xs,
    fontFamily: fonts.mono.extrabold,
    color: colors.foreground,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rideFooterText: {
    ...textSize['11'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  rideVerified: {
    ...textSize['11'],
    fontFamily: fonts.sans.bold,
    color: colors.accent,
  },
  footer: {
    paddingTop: 16,
  },
});
