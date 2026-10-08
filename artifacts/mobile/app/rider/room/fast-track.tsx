/**
 * Sleek 13 — Fast-Track Matchmaking (Instant Escape).
 * Calls POST /v1/rooms/next: the previous room's riders are blocked for 60 minutes and the
 * rider is seated in another R.O.O.M. of the same vibe.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getGetAuthMeQueryKey, useGetAuthMe, useLeaveRoom, useNextRoom } from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { vibeOption } from '@/constants/vibes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Card, ErrorBanner, GlowBlob, Icon, LiveDot, Ping, Pulse, Screen } from '@/components/ui';
import { StatRow } from '@/components/rideshare';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useTripStore } from '@/stores/trip.store';

/** Keep the matching animation on screen briefly so the switch doesn't feel like a glitch. */
const MIN_DISPLAY_MS = 1_200;

export default function FastTrackScreen() {
  const router = useRouter();
  const next = useNextRoom();
  const leave = useLeaveRoom();
  const me = useGetAuthMe({ query: { queryKey: getGetAuthMeQueryKey() } });
  const snapshot = useTripStore((s) => s.snapshot);
  const vibe = useTripStore((s) => s.room?.vibe);
  const [error, setError] = useState<string | null>(null);
  const [matchMs, setMatchMs] = useState<number | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    const begin = Date.now();
    try {
      const session = await next.mutateAsync();
      const elapsed = Date.now() - begin;
      setMatchMs(elapsed);
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_DISPLAY_MS - elapsed)));
      useTripStore.getState().setRoom(session);
      router.replace(routes.activeRoom);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not find another R.O.O.M.'));
    }
  }, [next, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  const cancel = async () => {
    // Leaving the old room already happened server-side if Next succeeded; make sure we're out.
    await leave.mutateAsync().catch(() => undefined);
    useTripStore.getState().setRoom(null);
    useTripStore.getState().setActive(true);
    router.replace(routes.vibeSelection);
  };

  const vibeLabel = vibeOption(vibe).label;

  return (
    <Screen
      spaceBetween
      contentStyle={styles.content}
      background={
        <>
          <GlowBlob color={colors.primary} opacity={0.1} size={320} style={styles.glowTopRight} />
          <GlowBlob color={colors.blue500} opacity={0.1} size={320} style={styles.glowBottomLeft} />
        </>
      }
    >
      <View style={styles.header}>
        <View style={styles.livePill}>
          <LiveDot />
          <Text style={styles.livePillText}>Verified Transit Active</Text>
        </View>
        <View style={styles.escapePill}>
          <Text style={styles.escapeText}>Fast Escape Mode</Text>
        </View>
      </View>

      <View style={styles.center}>
        <View style={styles.radar}>
          <Ping style={styles.radarPing} />
          <View style={styles.radarCore}>
            <Pulse style={styles.radarIcon}>
              <Icon name="solarForwardBold" size={36} color={colors.primary} />
            </Pulse>
          </View>
        </View>

        <View style={styles.copy}>
          <View style={styles.blacklistPill}>
            <Icon name="solarShieldCheckBold" size={13} color={colors.accent} />
            <Text style={styles.blacklistText}>Previous Room Temporarily Blacklisted</Text>
          </View>
          <Text style={styles.title}>{matchMs != null ? 'Room found!' : 'Matching Next Room…'}</Text>
          <Text style={styles.body}>
            Finding verified in-transit riders who match your <Text style={styles.bodyHighlight}>{vibeLabel}</Text> vibe.
          </Text>
        </View>

        <Card style={styles.stats}>
          <StatRow
            label="Speed Telemetry"
            value={`${snapshot?.speedMph ?? 0} MPH ${snapshot?.state === 'VERIFIED' ? 'Verified' : ''}`.trim()}
            mono
            valueStyle={{ color: snapshot?.state === 'VERIFIED' ? colors.accent : colors.chart3 }}
          />
          <StatRow label="Queue Match Time" value={matchMs != null ? `${(matchMs / 1000).toFixed(1)}s` : 'Searching…'} mono />
          <StatRow label="Rolling Region" value={me.data?.homeCity ?? 'Nearby riders'} />
          <View style={styles.progressTrack}>
            <Pulse style={styles.progressFill} />
          </View>
        </Card>

        {error ? <ErrorBanner message={error} style={styles.error} /> : null}
      </View>

      <View style={styles.footer}>
        {error ? (
          <Button label="Try Again" height={48} borderRadius={radius.xl} size="xs" onPress={() => void run()} loading={next.isPending} />
        ) : null}
        <Button
          label="Change Vibe / Cancel Search"
          variant="outline"
          height={48}
          borderRadius={radius.xl}
          size="xs"
          weight="semibold"
          onPress={() => void cancel()}
        />
        <Text style={styles.footnote}>Peer blacklisting auto-expires in 60 minutes.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { width: '100%', maxWidth: 320 },
  content: {
    padding: 20,
  },
  glowTopRight: {
    top: -96,
    right: -96,
  },
  glowBottomLeft: {
    bottom: -96,
    left: -96,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.xs,
  },
  livePillText: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
  },
  escapePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.destructive, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(colors.destructive, 0.2),
  },
  escapeText: {
    ...textSize['11'],
    fontFamily: fonts.sans.bold,
    color: colors.destructive,
  },
  center: {
    alignItems: 'center',
    gap: 24,
    marginVertical: 24,
  },
  radar: {
    width: 144,
    height: 144,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPing: {
    position: 'absolute',
    width: 144,
    height: 144,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, 0.2),
    backgroundColor: withAlpha(colors.primary, 0.05),
  },
  radarCore: {
    width: 112,
    height: 112,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: withAlpha(colors.primary, 0.4),
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },
  radarIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: 8,
    maxWidth: 320,
  },
  blacklistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blacklistText: {
    ...textSize['11'],
    fontFamily: fonts.sans.bold,
    color: colors.mutedForeground,
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
  bodyHighlight: {
    fontFamily: fonts.sans.bold,
    color: colors.primary,
  },
  stats: {
    width: '100%',
    maxWidth: 320,
    padding: 16,
    gap: 12,
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
    width: '66.666%',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  footer: {
    gap: 10,
  },
  footnote: {
    ...textSize['10'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
