/**
 * Sleek 12 — Traffic Grace Period (5-minute hold over the room).
 * Opens automatically when the engine enters GRACE inside a R.O.O.M.; closes itself when
 * speed recovers (VERIFIED). Exit ends the ride.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLeaveRoom } from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Bounce, Button, Icon, Ping, Screen } from '@/components/ui';
import { formatCountdown, useGraceCountdown } from '@/hooks/use-grace-countdown';
import { useTripStore } from '@/stores/trip.store';
import { formatGraceDuration, thresholdsOf } from '@/lib/validation/thresholds';

const NO_MEMBERS: never[] = [];

function BlurredRoom() {
  // Stable fallback: a fresh [] each render would make zustand re-render forever.
  const members = useTripStore((s) => s.room?.members ?? NO_MEMBERS);
  const tiles = members.slice(0, 6);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.backdropGrid}>
        {[0, 1].map((row) => (
          <View key={row} style={styles.backdropRow}>
            {Array.from({ length: 3 }, (_, col) => {
              const m = tiles[row * 3 + col];
              return (
                <View key={col} style={styles.backdropTile}>
                  {m?.photoUrl ? (
                    <Image source={{ uri: m.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={4} />
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.dim} />
    </View>
  );
}

export default function TrafficGraceScreen() {
  const router = useRouter();
  const snapshot = useTripStore((s) => s.snapshot);
  const leave = useLeaveRoom();
  const remaining = useGraceCountdown(snapshot?.state === 'GRACE' ? snapshot.graceDeadline : null);

  // Speed recovered → back to the room.
  useEffect(() => {
    if (snapshot?.state === 'VERIFIED' && router.canGoBack()) router.back();
  }, [snapshot?.state, router]);

  const exit = async () => {
    try {
      const summary = await leave.mutateAsync();
      useTripStore.getState().setSummary(summary);
    } catch {
      // Summary screen retries.
    }
    useTripStore.getState().setRoom(null);
    router.replace(routes.rideSummary);
  };

  const stay = () => (router.canGoBack() ? router.back() : router.replace(routes.activeRoom));
  const thresholds = thresholdsOf(snapshot);
  const progress =
    remaining == null ? 1 : Math.max(0, Math.min(1, remaining / Math.max(1, thresholds.graceDurationSec)));
  const vibrationOk = snapshot?.checks.vibration === true;

  return (
    <Screen spaceBetween contentStyle={styles.content} background={<BlurredRoom />} statusBar="light">
      <View style={styles.topRow}>
        <View style={styles.alertPill}>
          <View style={styles.pingWrap}>
            <Ping style={styles.pingDot} />
            <View style={styles.pingDot} />
          </View>
          <Text style={styles.alertText}>Speed Drop Detected</Text>
        </View>
        <View style={styles.speedPill}>
          <Text style={styles.speedText}>{Math.round(snapshot?.speedMph ?? 0)} MPH · Stoplight / Traffic</Text>
        </View>
      </View>

      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Bounce>
              <Icon name="solarTrafficBold" size={32} color={colors.chart3} />
            </Bounce>
          </View>

          <View style={styles.copy}>
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>Traffic Grace Active</Text>
            </View>
            <Text style={styles.title}>{formatGraceDuration(thresholds.graceDurationSec)} State Hold</Text>
            <Text style={styles.body}>
              Your ride paused at a traffic light or congestion. We are keeping your seat in the room active
              while waiting for speed recovery.
            </Text>
          </View>

          <View style={styles.countdown}>
            <View>
              <Text style={styles.countdownLabel}>Hold Countdown</Text>
              <Text style={styles.countdownValue}>{formatCountdown(remaining)}</Text>
            </View>
            <View style={styles.threshold}>
              <Text style={styles.countdownLabel}>Threshold</Text>
              <Text style={styles.thresholdValue}>
                {'>'}
                {thresholds.entryMph} MPH resumes
              </Text>
            </View>
          </View>

          <View style={styles.progressGroup}>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={[colors.chart3, colors.amber400]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>
                Accelerometer micro-vibrations: {vibrationOk ? 'Active' : 'Quiet (EV / engine off)'}
              </Text>
              <Text style={styles.progressOk}>In-Car Sync OK</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Button label="Stay in Room" variant="secondary" height={44} borderRadius={radius.xl} size="xs" style={styles.action} onPress={stay} />
            <Button
              label="Exit Now"
              variant="destructive"
              height={44}
              borderRadius={radius.xl}
              size="xs"
              style={styles.action}
              loading={leave.isPending}
              onPress={() => void exit()}
            />
          </View>
        </View>
      </View>

      <Text style={styles.footer}>
        Auto-disconnects if vehicle remains stationary after {formatCountdown(thresholds.graceDurationSec)} minutes.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  backdropGrid: {
    flex: 1,
    padding: 8,
    gap: 8,
    opacity: 0.4,
    transform: [{ scale: 1.05 }],
  },
  backdropRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  backdropTile: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(colors.black, 0.6),
  },
  topRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.black, 0.5),
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.1),
  },
  pingWrap: {
    width: 8,
    height: 8,
  },
  pingDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.chart3,
  },
  alertText: {
    ...textSize.xs,
    fontFamily: fonts.sans.semibold,
    color: colors.white,
  },
  speedPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.black, 0.4),
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.1),
  },
  speedText: {
    ...textSize['11'],
    fontFamily: fonts.mono.bold,
    color: withAlpha(colors.white, 0.8),
  },
  cardWrap: {
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
    marginVertical: 24,
  },
  card: {
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.15),
    backgroundColor: withAlpha(colors.card, 0.92),
    padding: 24,
    gap: 16,
    alignItems: 'stretch',
    ...shadow['2xl'],
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: radius['2xl'],
    backgroundColor: withAlpha(colors.chart3, 0.15),
    borderWidth: 1,
    borderColor: withAlpha(colors.chart3, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  copy: {
    gap: 4,
    alignItems: 'center',
  },
  activePill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.chart3, 0.1),
  },
  activePillText: {
    ...textSize['11'],
    fontFamily: fonts.sans.bold,
    color: colors.chart3,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(11),
  },
  title: {
    ...textSize['2xl'],
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    letterSpacing: tracking.tight(24),
    textAlign: 'center',
  },
  body: {
    ...textSize.xs,
    lineHeight: 20,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: radius['2xl'],
    backgroundColor: withAlpha(colors.secondary, 0.8),
    borderWidth: 1,
    borderColor: colors.border,
  },
  countdownLabel: {
    ...textSize['10'],
    fontFamily: fonts.sans.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.widest(10),
  },
  countdownValue: {
    ...textSize['3xl'],
    fontFamily: fonts.mono.extrabold,
    color: colors.chart3,
    letterSpacing: tracking.tight(30),
  },
  threshold: {
    alignItems: 'flex-end',
  },
  thresholdValue: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
    marginTop: 4,
  },
  progressGroup: {
    gap: 8,
    paddingTop: 4,
  },
  progressTrack: {
    height: 6,
    width: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressLabel: {
    ...textSize['10'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    flexShrink: 1,
  },
  progressOk: {
    ...textSize['10'],
    fontFamily: fonts.sans.bold,
    color: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  action: {
    flex: 1,
    width: undefined,
  },
  footer: {
    ...textSize['11'],
    fontFamily: fonts.sans.medium,
    color: withAlpha(colors.white, 0.7),
    textAlign: 'center',
  },
});
