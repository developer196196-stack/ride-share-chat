/** Sleek 11 — Disconnect / Ride Summary. Real stats from the ended ride session. */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { leaveRoom, type RideSummary } from '@workspace/api-client-react';
import { colors } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { vibeOption } from '@/constants/vibes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Card, ErrorBanner, Icon, Screen } from '@/components/ui';
import { LogoTile, StatRow } from '@/components/rideshare';
import { ReportSheet } from '@/components/room/ReportSheet';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useTripStore } from '@/stores/trip.store';

const RATINGS = ['😴', '🙂', '⚡', '🔥', '🚀'];

const END_REASONS: Record<string, string> = {
  user_ended: 'You ended the session',
  grace_expired: 'Vehicle stopped longer than 5 minutes',
  exited_vehicle: 'Drop-off detected — you left the vehicle',
  spoof_detected: 'Ended by Trip Validation (spoofing detected)',
  signal_lost: 'Trip signal lost',
};

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export default function RideSummaryScreen() {
  const router = useRouter();
  const stored = useTripStore((s) => s.summary);
  const termination = useTripStore((s) => s.termination);
  const [summary, setSummary] = useState<RideSummary | null>(stored);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    // The trip is over: stop telemetry and leave any room.
    const store = useTripStore.getState();
    store.setActive(false);
    store.setRoom(null);
    if (stored) return;
    leaveRoom()
      .then((result) => {
        setSummary(result);
        useTripStore.getState().setSummary(result);
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load the ride summary.')));
  }, [stored]);

  const roomShare =
    summary && summary.durationSec > 0 ? Math.min(100, Math.round((summary.roomDurationSec / summary.durationSec) * 1000) / 10) : 0;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <LogoTile size={80} padding={10} rounded="3xl" elevation="md" style={styles.logo} />
        <Text style={styles.title}>Ride session completed</Text>
        <Text style={styles.subtitle}>
          {termination?.message ?? 'Trip ended · You’ve safely disconnected from the room.'}
        </Text>
      </View>

      {error ? <ErrorBanner message={error} style={styles.banner} /> : null}
      {!summary && !error ? <ActivityIndicator color={colors.primary} style={styles.banner} /> : null}

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>Chat Duration</Text>
          <Text style={styles.statValue}>{summary ? formatDuration(summary.roomDurationSec) : '—'}</Text>
          <Text style={[styles.statCaption, styles.statCaptionAccent]}>
            {summary ? `${summary.peersMet} passenger${summary.peersMet === 1 ? '' : 's'} met` : ' '}
          </Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statLabel}>Validated Distance</Text>
          <Text style={styles.statValue}>{summary ? `${summary.distanceMiles} mi` : '—'}</Text>
          <Text style={styles.statCaption}>{summary ? `Avg ${summary.avgMph} MPH` : ' '}</Text>
        </Card>
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Trip Validation Telemetry</Text>
        <View style={styles.rows}>
          <StatRow label="Validated ride duration" value={summary ? formatDuration(summary.durationSec) : '—'} />
          <StatRow label="Time in R.O.O.M.s" value={summary ? `${roomShare}% of ride` : '—'} />
          <StatRow
            label="Traffic grace periods triggered"
            value={summary ? `${summary.graceCount} time${summary.graceCount === 1 ? '' : 's'} (${formatDuration(summary.graceSeconds)} total)` : '—'}
          />
          <StatRow
            label="Session end"
            value={summary ? (END_REASONS[summary.endReason] ?? summary.endReason) : '—'}
            valueStyle={{ color: summary?.endReason === 'user_ended' || summary?.endReason === 'exited_vehicle' ? colors.accent : colors.chart3 }}
          />
          <StatRow label="Vibe category" value={summary?.vibe ? vibeOption(summary.vibe).label : '—'} valueStyle={{ color: colors.primary }} />
        </View>
      </Card>

      <Card style={[styles.section, styles.ratingSection]}>
        <Text style={[styles.sectionTitle, styles.ratingTitle]}>How was your room experience?</Text>
        <Text style={styles.ratingBody}>Your rating helps improve room matching quality and community safety.</Text>
        <View style={styles.ratings}>
          {RATINGS.map((emoji, i) => (
            <Pressable
              key={emoji}
              hitSlop={6}
              onPress={() => setRating(i)}
              style={({ pressed }) => [pressed && styles.ratingPressed, rating === i && styles.ratingSelected]}
              accessibilityLabel={`Rate ${i + 1} of 5`}
            >
              <Text style={styles.ratingEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.reportButton} onPress={() => setReportOpen(true)}>
          <Icon name="solarShieldWarningLinear" size={16} color={colors.primary} />
          <Text style={styles.reportText}>Report inappropriate participant / conduct</Text>
        </Pressable>
      </Card>

      <View style={styles.actions}>
        <Button
          label="Start a New Ride"
          icon="solarRefreshCircleBold"
          iconSize={20}
          iconPosition="left"
          height={48}
          borderRadius={radius.xl}
          onPress={() => router.replace(routes.validation)}
        />
        <View style={styles.secondaryActions}>
          <Button
            label="Settings"
            variant="outline"
            icon="solarSettingsLinear"
            iconSize={16}
            iconPosition="left"
            height={44}
            borderRadius={radius.xl}
            size="xs"
            weight="semibold"
            style={styles.half}
            onPress={() => router.push(routes.settings)}
          />
          <Button
            label="Profile & Stats"
            variant="outline"
            icon="solarUserCircleLinear"
            iconSize={16}
            iconPosition="left"
            height={44}
            borderRadius={radius.xl}
            size="xs"
            weight="semibold"
            style={styles.half}
            onPress={() => router.push(routes.connections)}
          />
        </View>
      </View>
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} roomId={null} members={[]} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: 16 },
  ratingSelected: { transform: [{ scale: 1.25 }] },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    marginBottom: 12,
  },
  title: {
    ...textSize['2xl'],
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    textAlign: 'center',
  },
  subtitle: {
    ...textSize.sm,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    padding: 16,
  },
  statLabel: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(12),
  },
  statValue: {
    ...textSize['2xl'],
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    marginTop: 4,
  },
  statCaption: {
    ...textSize['11'],
    fontFamily: fonts.sans.medium,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  statCaptionAccent: {
    fontFamily: fonts.sans.semibold,
    color: colors.accent,
  },
  section: {
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    ...textSize.base,
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    marginBottom: 12,
  },
  rows: {
    gap: 12,
  },
  ratingSection: {
    marginBottom: 24,
  },
  ratingTitle: {
    marginBottom: 8,
  },
  ratingBody: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    marginBottom: 16,
  },
  ratings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  ratingPressed: {
    transform: [{ scale: 1.1 }],
  },
  ratingEmoji: {
    fontSize: 24,
    lineHeight: 32,
  },
  reportButton: {
    height: 40,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reportText: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  actions: {
    gap: 12,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
    width: undefined,
    paddingHorizontal: 8,
  },
});
