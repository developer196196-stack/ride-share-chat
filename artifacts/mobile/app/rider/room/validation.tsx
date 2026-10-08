/**
 * Sleek 8 — Trip Validation (pending / pre-verification) screen.
 * Live Trip Validation Engine state: speed (Module 1), vibration (Module 2), ground truth
 * (Module 3), weighted score and state. Enter Vibe Queue unlocks at VERIFIED.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ValidationSnapshot } from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';
import { routes } from '@/constants/routes';
import type { IconName } from '@/constants/icons';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Card, ErrorBanner, GlowBlob, Icon, IconButton, LiveDot, Pill, Screen, Spin } from '@/components/ui';
import { LogoTile } from '@/components/rideshare';
import { SafetyFab } from '@/components/safety/SafetyFab';
import { SafetySheet } from '@/components/safety/SafetySheet';
import { useTrip } from '@/hooks/use-trip';
import { env } from '@/lib/config/env';
import { useSimulatorStore, type SimulatorScenario } from '@/stores/simulator.store';
import { useTripStore } from '@/stores/trip.store';
import { formatGraceDuration, thresholdsOf } from '@/lib/validation/thresholds';

const BAR_PATTERN = [0.35, 0.55, 0.9, 0.7, 1, 0.8, 0.45, 0.65, 0.35];

type CheckState = 'done' | 'pending' | 'failed' | 'unavailable';
type Check = { icon: IconName; title: string; caption: string; state: CheckState };

const STATE_COPY: Record<ValidationSnapshot['state'], { title: string; pill: string }> = {
  PENDING: { title: 'Verifying your ride', pill: 'Pending' },
  VERIFIED: { title: 'Transit verified', pill: 'Active Ride' },
  GRACE: { title: 'Vehicle stopped', pill: 'Grace Period' },
  TERMINATED: { title: 'Session ended', pill: 'Terminated' },
};

function checklist(s: ValidationSnapshot | null): Check[] {
  const speed = s?.speedMph ?? 0;
  const entry = thresholdsOf(s).entryMph;
  const gps: CheckState = s?.checks.gpsSpeedLock ? 'done' : 'pending';
  const vibration: CheckState = s?.checks.vibration == null ? 'unavailable' : s.checks.vibration ? 'done' : 'pending';
  let ground: CheckState;
  if (s?.checks.onRoad === false) ground = 'failed';
  else if (s?.checks.groundTruth == null) ground = 'unavailable';
  else ground = s.checks.groundTruth ? 'done' : 'pending';

  const groundCaption: Record<CheckState, string> = {
    failed: 'Not on a drivable road',
    done: s?.checks.onRoad ? 'In-vehicle activity · on a drivable road' : 'In-vehicle activity detected',
    unavailable: 'Waiting for activity & road matching…',
    pending: 'Checking vehicle activity…',
  };
  const vibrationCaption: Record<CheckState, string> = {
    done: 'Micro-vibrations match vehicle cabin motion',
    unavailable: 'Accelerometer data not available yet',
    pending: 'Synchronizing accelerometer stream…',
    failed: 'No vehicle vibration detected',
  };

  return [
    {
      icon: 'solarSatelliteLinear',
      title: 'GPS speed lock',
      caption: gps === 'done' ? `Strong · ${speed} MPH detected` : `Waiting for > ${entry} MPH · now ${speed} MPH`,
      state: gps,
    },
    { icon: 'solarRouteLinear', title: 'Vehicle ground truth', caption: groundCaption[ground], state: ground },
    { icon: 'solarRunning2Linear', title: 'Vibration telemetry', caption: vibrationCaption[vibration], state: vibration },
  ];
}

const SCENARIOS: { key: SimulatorScenario; label: string }[] = [
  { key: 'off', label: 'Real sensors' },
  { key: 'driving', label: 'Drive' },
  { key: 'stopped_idle', label: 'Red light' },
  { key: 'stopped_ev', label: 'EV stop' },
  { key: 'walking', label: 'Walk out' },
];

export default function TripValidationScreen() {
  const router = useRouter();
  const { startTrip } = useTrip();
  const snapshot = useTripStore((s) => s.snapshot);
  const connected = useTripStore((s) => s.connected);
  const scenario = useSimulatorStore((s) => s.scenario);
  const setScenario = useSimulatorStore((s) => s.setScenario);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    void startTrip();
  }, [startTrip]);

  const state = snapshot?.state ?? 'PENDING';
  const copy = STATE_COPY[state];
  const checks = checklist(snapshot);
  const completed = checks.filter((c) => c.state === 'done').length;
  const speed = snapshot?.speedMph ?? 0;
  const vibrationLevel = Math.max(0.15, (snapshot?.modules.vibration ?? 0) / 100);
  const verified = state === 'VERIFIED';
  const thresholds = thresholdsOf(snapshot);

  let ctaLabel = 'Waiting for verification…';
  if (verified) ctaLabel = 'Enter Vibe Queue';
  else if (state === 'GRACE') ctaLabel = 'Waiting for speed recovery…';

  return (
    <View style={styles.root}>
      <Screen contentStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LogoTile size={56} padding={6} rounded="2xl" elevation="sm" />
            <View>
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, !connected && { backgroundColor: colors.chart3 }]} />
                <Text style={styles.stepText}>{connected ? 'Step 1 of 3' : 'Connecting…'}</Text>
              </View>
              <Text style={styles.title}>Trip Validation</Text>
            </View>
          </View>
          <IconButton icon="solarQuestionCircleLinear" onPress={() => router.push(routes.howItWorks)} />
        </View>

        <Card style={styles.telemetry}>
          <GlowBlob color={colors.primary} opacity={0.1} size={224} style={styles.telemetryGlow} />
          <View style={styles.telemetryHeader}>
            <View>
              <Text style={styles.telemetryEyebrow}>LIVE SENSOR TELEMETRY</Text>
              <Text style={styles.telemetryTitle}>{copy.title}</Text>
            </View>
            <View style={styles.activePill}>
              <LiveDot size={6} color={verified ? colors.accent : colors.chart3} />
              <Text style={[styles.activePillText, !verified && { color: colors.chart3 }]}>{copy.pill}</Text>
            </View>
          </View>

          <View style={styles.gaugeWrap}>
            <View style={styles.gauge}>
              <View style={[styles.gaugeArc, !snapshot?.checks.gpsSpeedLock && styles.gaugeArcIdle]} />
              <Text style={styles.speed}>{Math.round(speed)}</Text>
              <Text style={styles.speedUnit}>MPH</Text>
              <View style={styles.thresholdAnchor} pointerEvents="none">
                <View style={styles.thresholdBase}>
                  <View style={styles.thresholdPill}>
                    <Text style={styles.thresholdText}>
                      {snapshot?.checks.gpsSpeedLock
                        ? `> ${thresholds.entryMph} MPH Threshold Met`
                        : `Needs > ${thresholds.entryMph} MPH for ${thresholds.entrySustainSec} s`}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.bars}>
            {BAR_PATTERN.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: 6 + 30 * h * vibrationLevel,
                    backgroundColor: withAlpha(colors.primary, Math.min(1, 0.3 + 0.7 * h * vibrationLevel)),
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.telemetryCaption}>Validation score</Text>
            <Text style={styles.scoreValue}>
              {snapshot?.score ?? 0}/100 · needs {thresholds.verifiedScore}
            </Text>
          </View>
        </Card>

        {state === 'TERMINATED' ? (
          <ErrorBanner style={styles.banner} message="This validation session ended. Tap Restart to verify a new ride." />
        ) : null}

        <View style={styles.checklistSection}>
          <View style={styles.checklistHeader}>
            <Text style={styles.sectionTitle}>Verification Checklist</Text>
            <Text style={styles.sectionMeta}>{completed} of 3 complete</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(completed / 3) * 100}%` }]} />
          </View>
          <Card rounded="xl" style={styles.checklist}>
            {checks.map((c, i) => {
              let tint: string = colors.primary;
              if (c.state === 'done') tint = colors.accent;
              else if (c.state === 'failed') tint = colors.destructive;
              return (
                <View key={c.title} style={[styles.checkRow, i > 0 && styles.checkDivider]}>
                  <View style={[styles.checkIcon, { backgroundColor: withAlpha(tint, 0.1) }]}>
                    <Icon name={c.icon} size={20} color={tint} />
                  </View>
                  <View style={styles.checkText}>
                    <Text style={styles.checkTitle}>{c.title}</Text>
                    <Text style={styles.checkCaption}>{c.caption}</Text>
                  </View>
                  {c.state === 'done' ? <Icon name="solarCheckCircleBold" size={20} color={colors.accent} /> : null}
                  {c.state === 'failed' ? <Icon name="solarCloseCircleLinear" size={20} color={colors.destructive} /> : null}
                  {c.state === 'unavailable' ? (
                    <Icon name="solarQuestionCircleLinear" size={20} color={colors.mutedForeground} />
                  ) : null}
                  {c.state === 'pending' ? <Spin style={styles.spinner} /> : null}
                </View>
              );
            })}
          </Card>
        </View>

        <Card rounded="xl" style={styles.grace}>
          <View style={styles.graceLeft}>
            <View style={styles.graceIcon}>
              <Icon name="solarLockKeyholeLinear" size={20} color={colors.mutedForeground} />
            </View>
            <View style={styles.graceText}>
              <Text style={styles.checkTitle}>{formatGraceDuration(thresholds.graceDurationSec)} Traffic Grace Timer</Text>
              <Text style={styles.checkCaption}>Stay in room during red lights and heavy jams</Text>
            </View>
          </View>
          <Pill label="Always on" tone="accent" size="10" />
        </Card>

        {env.allowSimulatedRide ? (
          <Card rounded="xl" style={styles.simulator}>
            <Text style={styles.simTitle}>Dev ride simulator</Text>
            <View style={styles.simRow}>
              {SCENARIOS.map((sc) => (
                <Pressable
                  key={sc.key}
                  onPress={() => setScenario(sc.key)}
                  style={[styles.simChip, scenario === sc.key && styles.simChipActive]}
                >
                  <Text style={[styles.simChipText, scenario === sc.key && { color: colors.primary }]}>{sc.label}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        {state === 'TERMINATED' ? (
          <Button
            label="Restart Validation"
            icon="solarRefreshCircleBold"
            iconSize={20}
            iconPosition="left"
            height={48}
            borderRadius={radius.xl}
            weight="semibold"
            style={styles.cta}
            onPress={() => void startTrip()}
          />
        ) : (
          <Button
            label={ctaLabel}
            icon="solarLogin2Bold"
            iconSize={20}
            iconPosition="left"
            height={48}
            borderRadius={radius.xl}
            weight="semibold"
            style={styles.cta}
            disabled={!verified}
            onPress={() => router.push(routes.vibeSelection)}
          />
        )}
        <Button
          label="Share Trip Status"
          variant="outline"
          icon="solarMapPointBold"
          iconSize={16}
          iconPosition="left"
          height={44}
          borderRadius={radius.xl}
          size="xs"
          weight="semibold"
          style={styles.shareButton}
          onPress={() => setShareOpen(true)}
        />
        <Text style={styles.footnote}>Telemetry runs exclusively while actively commuting.</Text>
      </Screen>
      <SafetyFab style={styles.fab} />
      <SafetySheet visible={shareOpen} onClose={() => setShareOpen(false)} />
    </View>
  );
}

const GAUGE = 192;
const RING = 10;

const styles = StyleSheet.create({
  root: { flex: 1 },
  fab: { bottom: 32 },
  banner: { marginTop: 16 },
  scoreRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  scoreValue: { ...textSize.xs, fontFamily: fonts.mono.bold, color: colors.foreground, marginTop: 12 },
  gaugeArcIdle: { borderTopColor: colors.slate400, borderRightColor: colors.slate400 },
  shareButton: { marginTop: 10 },
  simulator: { marginTop: 16, padding: 12, gap: 8, borderStyle: 'dashed' },
  simTitle: { ...textSize['11'], fontFamily: fonts.mono.bold, color: colors.mutedForeground, textTransform: 'uppercase' },
  simRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  simChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
  },
  simChipActive: { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, 0.08) },
  simChipText: { ...textSize.xs, fontFamily: fonts.sans.semibold, color: colors.foreground },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  stepText: {
    ...textSize['11'],
    fontFamily: fonts.sans.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.em(11, 0.2),
  },
  title: {
    ...textSize['2xl'],
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    letterSpacing: tracking.tight(24),
  },
  telemetry: {
    padding: 20,
    overflow: 'hidden',
  },
  telemetryGlow: {
    top: -96,
    right: -80,
  },
  telemetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  telemetryEyebrow: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.mutedForeground,
    letterSpacing: tracking.wide(12),
  },
  telemetryTitle: {
    ...textSize.lg,
    fontFamily: fonts.heading.semibold,
    color: colors.foreground,
    marginTop: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.accent, 0.1),
  },
  activePillText: {
    ...textSize.xs,
    fontFamily: fonts.sans.semibold,
    color: colors.accent,
  },
  gaugeWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  gauge: {
    width: GAUGE,
    height: GAUGE,
    borderRadius: radius.full,
    borderWidth: RING,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeArc: {
    position: 'absolute',
    top: -RING,
    left: -RING,
    width: GAUGE,
    height: GAUGE,
    borderRadius: radius.full,
    borderWidth: RING,
    borderColor: 'transparent',
    borderTopColor: colors.primary,
    borderRightColor: colors.primary,
    transform: [{ rotate: '35deg' }],
  },
  speed: {
    ...textSize['5xl'],
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    letterSpacing: tracking.tight(48),
  },
  speedUnit: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  // `whitespace-nowrap` pill may extend past the ring, so anchor it wider than the gauge.
  thresholdAnchor: {
    position: 'absolute',
    bottom: 8,
    left: -60,
    right: -60,
    alignItems: 'center',
    // The rotated arc forms its own layer; keep the pill above it.
    zIndex: 2,
    elevation: 2,
  },
  // Opaque base so the translucent pill tint doesn't let the ring show through the text.
  thresholdBase: {
    borderRadius: radius.full,
    backgroundColor: colors.card,
  },
  thresholdPill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.primary, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0.2),
  },
  thresholdText: {
    ...textSize['10'],
    flexShrink: 0,
    fontFamily: fonts.sans.bold,
    color: colors.primary,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    marginTop: 12,
  },
  bar: {
    width: 6,
    borderRadius: radius.full,
  },
  telemetryCaption: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 12,
  },
  checklistSection: {
    marginTop: 20,
    gap: 12,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...textSize.sm,
    fontFamily: fonts.heading.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(14),
  },
  sectionMeta: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.primary,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  checklist: {
    overflow: 'hidden',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  checkDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    flex: 1,
  },
  checkTitle: {
    ...textSize.sm,
    fontFamily: fonts.sans.semibold,
    color: colors.foreground,
  },
  checkCaption: {
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    borderTopColor: 'transparent',
  },
  grace: {
    marginTop: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  graceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  graceIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  graceText: {
    flexShrink: 1,
  },
  cta: {
    marginTop: 20,
    ...shadow.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
  },
  footnote: {
    ...textSize['11'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 12,
  },
});
