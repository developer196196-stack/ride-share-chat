/**
 * Sleek 10 — Active R.O.O.M.
 * LiveKit video grid, translated chat overlay, grace countdown, Next (Instant Escape),
 * report, safety shield and hang up.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getCurrentRoom,
  getGetPreferencesQueryKey,
  listRoomMessages,
  useGetPreferences,
  useLeaveRoom,
  type ChatMessage,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import type { IconName } from '@/constants/icons';
import { radius, shadow, tintedShadow } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { vibeOption } from '@/constants/vibes';
import { fonts, textSize } from '@/constants/typography';
import { ErrorBanner, Icon, LiveDot, Screen } from '@/components/ui';
import { ChatOverlay } from '@/components/room/ChatOverlay';
import { ReportSheet } from '@/components/room/ReportSheet';
import { VideoRoom, type MediaControls } from '@/components/room/VideoRoom';
import { SafetyFab } from '@/components/safety/SafetyFab';
import { formatCountdown, useGraceCountdown } from '@/hooks/use-grace-countdown';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { ClientEvents } from '@/lib/realtime/events';
import { emitWithAck } from '@/lib/realtime/socket';
import { useAuthStore } from '@/stores/auth.store';
import { useTripStore } from '@/stores/trip.store';

function ControlButton({
  icon,
  onPress,
  off = false,
  disabled = false,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  off?: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.control,
        off && styles.controlOff,
        disabled && styles.controlDisabled,
        pressed && { backgroundColor: colors.muted },
      ]}
    >
      <Icon name={icon} size={20} color={off ? colors.destructive : colors.foreground} />
    </Pressable>
  );
}

export default function ActiveRoomScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const room = useTripStore((s) => s.room);
  const messages = useTripStore((s) => s.messages);
  const snapshot = useTripStore((s) => s.snapshot);
  const prefs = useGetPreferences({ query: { queryKey: getGetPreferencesQueryKey() } });
  const leave = useLeaveRoom();
  const [reportOpen, setReportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const graceLeft = useGraceCountdown(snapshot?.state === 'GRACE' ? snapshot.graceDeadline : null);

  // Restore the session (app reopened) and load recent chat.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!useTripStore.getState().room) {
          const current = await getCurrentRoom();
          if (cancelled) return;
          if (!current.room) {
            router.replace(routes.vibeSelection);
            return;
          }
          useTripStore.getState().setRoom(current.room);
        }
        const history = await listRoomMessages();
        if (!cancelled) useTripStore.getState().setMessages(history);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Could not load the R.O.O.M.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, room?.roomId]);

  const send = async (text: string) => {
    const message = await emitWithAck<ChatMessage>(ClientEvents.CHAT_MESSAGE_SENT, { text });
    useTripStore.getState().addMessage(message);
  };

  const hangUp = async () => {
    try {
      const summary = await leave.mutateAsync();
      useTripStore.getState().setSummary(summary);
    } catch {
      // Summary screen retries.
    }
    useTripStore.getState().setRoom(null);
    router.replace(routes.rideSummary);
  };

  if (!room) {
    return (
      <Screen contentStyle={styles.loading}>
        {error ? <ErrorBanner message={error} /> : <Text style={styles.loadingText}>Joining your R.O.O.M.…</Text>}
      </Screen>
    );
  }

  const vibe = vibeOption(room.vibe);
  const inGrace = snapshot?.state === 'GRACE';

  return (
    <View style={styles.root}>
      <Screen spaceBetween scroll={false} contentStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.modePill}>
              <Text style={styles.modePillText}>{vibe.label}</Text>
            </View>
            <View style={styles.transit}>
              <LiveDot />
              <Text style={styles.transitText}>
                {room.members.length}/{room.capacity} In transit
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            {inGrace ? (
              <Pressable style={styles.graceChip} onPress={() => router.push(routes.trafficGrace)}>
                <Icon name="solarTrafficLinear" size={14} color={colors.chart3} />
                <Text style={styles.graceChipText}>Grace: {formatCountdown(graceLeft)}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.nextRoom} onPress={() => router.push(routes.fastTrack)} accessibilityLabel="Next room">
              <Icon name="solarForwardBold" size={14} color={colors.primaryForeground} />
              <Text style={styles.nextRoomText}>Next Room</Text>
            </Pressable>
          </View>
        </View>

        {error ? <ErrorBanner message={error} style={styles.banner} /> : null}

        <View style={styles.stage}>
          <VideoRoom
            session={room}
            onVideoError={(message) => setError(`Video: ${message}`)}
            renderControls={(media: MediaControls) => (
              <>
                <View style={styles.chatWrap} pointerEvents="box-none">
                  <ChatOverlay
                    messages={messages}
                    selfUid={uid}
                    onSend={send}
                    subtitleSize={prefs.data?.subtitleSize}
                    subtitleStyle={prefs.data?.subtitleStyle}
                  />
                </View>
                <View style={styles.controls}>
                  <View style={styles.controlsLeft}>
                    <ControlButton
                      icon="solarMicrophoneLargeBold"
                      label={media.micOn ? 'Mute microphone' : 'Unmute microphone'}
                      off={media.available && !media.micOn}
                      disabled={!media.available}
                      onPress={media.toggleMic}
                    />
                    <ControlButton
                      icon="solarVideocameraBold"
                      label={media.camOn ? 'Turn camera off' : 'Turn camera on'}
                      off={media.available && !media.camOn}
                      disabled={!media.available}
                      onPress={media.toggleCam}
                    />
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.report, pressed && { backgroundColor: colors.secondary }]}
                    onPress={() => setReportOpen(true)}
                  >
                    <Icon name="solarShieldWarningBold" size={16} color={colors.primary} />
                    <Text style={styles.reportText}>Report</Text>
                  </Pressable>
                  <Pressable style={styles.hangUp} onPress={() => void hangUp()} accessibilityLabel="Leave and end ride">
                    <Icon name="solarPhoneCallingRoundedBold" size={20} color={colors.destructiveForeground} style={styles.hangUpIcon} />
                  </Pressable>
                </View>
              </>
            )}
          />
        </View>
      </Screen>
      <SafetyFab style={styles.fab} />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} roomId={room.roomId} members={room.members} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, padding: 24, justifyContent: 'center' },
  loadingText: { ...textSize.sm, fontFamily: fonts.sans.semibold, color: colors.mutedForeground, textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12, gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.primary },
  modePillText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.primaryForeground },
  transit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  transitText: { ...textSize.xs, fontFamily: fonts.sans.medium, color: colors.mutedForeground },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  graceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: withAlpha(colors.chart3, 0.3),
    backgroundColor: withAlpha(colors.chart3, 0.1),
  },
  graceChipText: { ...textSize.xs, fontFamily: fonts.mono.bold, color: colors.chart3 },
  nextRoom: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...shadow.sm,
  },
  nextRoomText: { ...textSize.xs, fontFamily: fonts.sans.semibold, color: colors.primaryForeground },
  banner: { marginBottom: 8 },
  stage: { flex: 1 },
  chatWrap: { position: 'absolute', left: 0, right: 0, bottom: 64 },
  controls: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  controlsLeft: { flexDirection: 'row', gap: 8 },
  control: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlOff: { borderColor: withAlpha(colors.destructive, 0.4), backgroundColor: withAlpha(colors.destructive, 0.08) },
  controlDisabled: { opacity: 0.45 },
  report: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.foreground },
  hangUp: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    ...tintedShadow(colors.destructive, 0.25, 'md'),
  },
  hangUpIcon: { transform: [{ rotate: '135deg' }] },
  fab: { bottom: 92 },
});
