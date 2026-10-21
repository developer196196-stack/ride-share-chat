/**
 * Sleek 10 — Active R.O.O.M.
 * LiveKit video grid, translated chat overlay, grace and post-ride countdowns, Next (Instant Escape),
 * report, safety shield and hang up. The host also gets the Moderation Toolkit (client doc 3):
 * long-press a tile to Eject / Force-Mute / Silent Flag, tap the mood pill for Dynamic Mood
 * Shifting, and the moderator panel for automatic/manual matching and the Privacy Lock.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ejectMember,
  flagMember,
  getCurrentRoom,
  getGetPreferencesQueryKey,
  listRoomMessages,
  muteMember,
  updateRoomSettings,
  type RoomSettingsUpdate,
  useGetPreferences,
  useLeaveRoom,
  type ChatMessage,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import type { IconName } from '@/constants/icons';
import { radius, shadow, tintedShadow } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { VIBE_OPTIONS, vibeOption } from '@/constants/vibes';
import { fonts, textSize } from '@/constants/typography';
import { ErrorBanner, Icon, LiveDot, Screen } from '@/components/ui';
import { ChatOverlay } from '@/components/room/ChatOverlay';
import { ReportSheet } from '@/components/room/ReportSheet';
import { VideoRoom, type MediaControls, type ModerationAction, type VideoEndReason } from '@/components/room/VideoRoom';
import { SafetyFab } from '@/components/safety/SafetyFab';
import { FocusFollow } from '@/components/social/FocusFollow';
import { InviteSheet, RequestsSheet } from '@/components/social/HostSheets';
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
  const [moodsOpen, setMoodsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const newRequests = useTripStore((s) => s.newRequests);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const graceLeft = useGraceCountdown(snapshot?.state === 'GRACE' ? snapshot.graceDeadline : null);
  // Post-ride extension: the rider has left the vehicle; the room stays live until the timer ends.
  const postRideLeft = useGraceCountdown(snapshot?.state === 'POST_RIDE' ? snapshot.postRideDeadline : null);

  // Restore the session (app reopened) and load recent chat.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!useTripStore.getState().room) {
          const current = await getCurrentRoom();
          if (cancelled) return;
          if (!current.room) {
            router.replace(routes.discover);
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

  /** Host: eject / force-mute / silent flag; errors keep the tile menu open to retry. */
  const moderate = async (target: string, action: ModerationAction) => {
    const name = useTripStore.getState().room?.members.find((m) => m.uid === target)?.displayName ?? 'Rider';
    setError(null);
    try {
      if (action === 'eject') {
        await ejectMember(target);
        useTripStore.getState().setNotice({ message: `${name} was removed from the room.` });
      } else if (action === 'mute') {
        await muteMember(target);
        useTripStore.getState().setNotice({ message: `${name} is muted. They can unmute later.` });
      } else {
        await flagMember(target, {});
        useTripStore.getState().setNotice({ message: `Flag sent to Trust & Safety. ${name} isn't notified.` });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'That host action failed. Try again.'));
      throw err;
    }
  };

  /** Host: mood shift, matching mode, privacy lock. Patches the room in place (no video reconnect). */
  const applySettings = async (update: RoomSettingsUpdate) => {
    const roomId = useTripStore.getState().room?.roomId;
    if (!roomId || settingsBusy) return;
    setError(null);
    setSettingsBusy(true);
    try {
      const session = await updateRoomSettings(update);
      useTripStore.getState().setRoomSettings(roomId, {
        vibe: session.vibe,
        matching: session.matching,
        locked: session.locked,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update the room.'));
    } finally {
      setSettingsBusy(false);
    }
  };

  /**
   * LiveKit says this device's video ended for good (removed, same account elsewhere, room gone).
   * Hang up, Next, ejection and ride termination already handle themselves, so only act when the
   * room is still the current one. Never follow the account into another room automatically: that
   * would kick the other device and the two would bounce back and forth.
   */
  const videoEnded = async (reason: VideoEndReason) => {
    const roomId = useTripStore.getState().room?.roomId;
    if (!roomId) return;
    let current: Awaited<ReturnType<typeof getCurrentRoom>>['room'] = null;
    try {
      current = (await getCurrentRoom()).room;
    } catch {
      return;
    }
    const store = useTripStore.getState();
    if (store.room?.roomId !== roomId || store.termination) return;
    if (current?.roomId === roomId) {
      if (reason === 'duplicate') {
        store.setNotice({ message: 'Your account joined this room on another device, so video moved there.', tone: 'warning' });
      }
      return;
    }
    router.replace(routes.discover);
    store.setRoom(null);
    store.setNotice({
      message: current ? 'Your account joined another R.O.O.M. on another device.' : "You're no longer in this R.O.O.M.",
      tone: 'warning',
    });
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
  const postRide = snapshot?.state === 'POST_RIDE';
  const isHost = room.hostUid != null && room.hostUid === uid;
  const closed = room.locked || room.matching === 'manual';

  return (
    <View style={styles.root}>
      <Screen spaceBetween scroll={false} contentStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              disabled={!isHost}
              onPress={() => setMoodsOpen((open) => !open)}
              style={[styles.modePill, { backgroundColor: vibe.color }]}
              accessibilityRole={isHost ? 'button' : undefined}
              accessibilityLabel={isHost ? `Mood ${vibe.label}. Tap to shift the room's mood` : `Mood ${vibe.label}`}
            >
              <Text style={styles.modePillText}>#{vibe.label.replace(/\s+/g, '')}</Text>
              {isHost ? <Icon name="solarAltArrowDownLinear" size={12} color={colors.primaryForeground} /> : null}
            </Pressable>
            {closed ? (
              <View style={styles.privatePill}>
                <Icon name="solarLockKeyholeBold" size={11} color={colors.mutedForeground} />
                <Text style={styles.privatePillText}>Private</Text>
              </View>
            ) : null}
            {room.hostUid != null && room.hostUid === uid ? (
              <View style={styles.hostPill} accessibilityLabel="You are the host of this R.O.O.M.">
                <Text style={styles.hostPillText}>You're hosting</Text>
              </View>
            ) : null}
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
            {postRide ? (
              <View
                style={styles.postRideChip}
                accessibilityLabel={`Ride ended. Your R.O.O.M. stays live for ${formatCountdown(postRideLeft)}`}
              >
                <Icon name="solarHourglassLineBold" size={14} color={colors.accent} />
                <Text style={styles.postRideChipText}>Ride ended · {formatCountdown(postRideLeft)}</Text>
              </View>
            ) : (
              <Pressable style={styles.nextRoom} onPress={() => router.push(routes.fastTrack)} accessibilityLabel="Next room">
                <Icon name="solarForwardBold" size={14} color={colors.primaryForeground} />
                <Text style={styles.nextRoomText}>Next Room</Text>
              </Pressable>
            )}
            {/* Hidden for now; uncomment to restore. <SafetyFab inline /> */}
          </View>
        </View>

        {isHost && moodsOpen ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moods} contentContainerStyle={styles.moodsContent}>
            {VIBE_OPTIONS.map((option) => {
              const active = option.value === room.vibe;
              return (
                <Pressable
                  key={option.value}
                  disabled={active || settingsBusy}
                  onPress={() => {
                    setMoodsOpen(false);
                    void applySettings({ vibe: option.value });
                  }}
                  style={[styles.moodChip, { borderColor: option.color }, active && { backgroundColor: option.color }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Icon name={option.icon} size={14} color={active ? colors.white : option.color} />
                  <Text style={[styles.moodChipText, active && { color: colors.white }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {error ? <ErrorBanner message={error} style={styles.banner} /> : null}

        <View style={styles.stage}>
          <VideoRoom
            session={room}
            onVideoError={(message) => setError(`Video: ${message}`)}
            onVideoEnded={(reason) => void videoEnded(reason)}
            moderation={isHost ? { onAction: moderate } : undefined}
            renderFocusActions={(member) => <FocusFollow uid={member.uid} />}
            renderControls={(media: MediaControls) => (
              <>
                <View style={[styles.chatWrap, isHost && styles.chatWrapHost]} pointerEvents="box-none">
                  <ChatOverlay
                    messages={messages}
                    selfUid={uid}
                    onSend={send}
                    subtitleSize={prefs.data?.subtitleSize}
                    subtitleStyle={prefs.data?.subtitleStyle}
                  />
                </View>
                {isHost ? (
                  <View style={styles.modPanel}>
                    <Text style={styles.modLabel}>Host</Text>
                    <View style={styles.segment} accessibilityRole="radiogroup">
                      {(['auto', 'manual'] as const).map((mode) => {
                        const active = room.matching === mode;
                        return (
                          <Pressable
                            key={mode}
                            disabled={active || settingsBusy}
                            onPress={() => void applySettings({ matching: mode })}
                            style={[styles.segmentItem, active && styles.segmentActive]}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                            accessibilityLabel={mode === 'auto' ? 'Automated matching' : 'Manual control'}
                          >
                            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                              {mode === 'auto' ? 'Auto-fill' : 'Manual'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Pressable
                      disabled={settingsBusy}
                      onPress={() => void applySettings({ locked: !room.locked })}
                      style={[styles.lockButton, room.locked && styles.lockButtonOn]}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: room.locked }}
                      accessibilityLabel="Privacy lock"
                    >
                      {settingsBusy ? (
                        <ActivityIndicator size="small" color={room.locked ? colors.white : colors.foreground} />
                      ) : (
                        <Icon
                          name={room.locked ? 'solarLockKeyholeBold' : 'solarLockKeyholeLinear'}
                          size={16}
                          color={room.locked ? colors.white : colors.foreground}
                        />
                      )}
                      <Text style={[styles.lockText, room.locked && { color: colors.white }]}>{room.locked ? 'Locked' : 'Lock'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setInviteOpen(true)}
                      style={styles.textPill}
                      accessibilityRole="button"
                      accessibilityLabel="Invite friends"
                    >
                      <Icon name="solarUsersGroupRoundedBold" size={14} color={colors.foreground} />
                      <Text style={styles.textPillLabel}>Invite</Text>
                    </Pressable>
                    {closed || newRequests > 0 ? (
                      <Pressable
                        onPress={() => {
                          useTripStore.getState().setNewRequests(0);
                          setRequestsOpen(true);
                        }}
                        style={styles.textPill}
                        accessibilityRole="button"
                        accessibilityLabel={`Join requests${newRequests > 0 ? `, ${newRequests} new` : ''}`}
                      >
                        <Icon name="solarLogin2Bold" size={14} color={colors.foreground} />
                        <Text style={styles.textPillLabel}>Requests</Text>
                        {newRequests > 0 ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{newRequests}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
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
      {isHost ? (
        <>
          <InviteSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} memberUids={room.members.map((m) => m.uid)} />
          <RequestsSheet visible={requestsOpen} onClose={() => setRequestsOpen(false)} />
        </>
      ) : null}
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
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  privatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
  },
  privatePillText: { ...textSize['11'], fontFamily: fonts.sans.semibold, color: colors.mutedForeground },
  moods: { flexGrow: 0, marginBottom: 10 },
  moodsContent: { gap: 8 },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1.5,
    backgroundColor: colors.card,
  },
  moodChipText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.foreground },
  modPanel: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modLabel: { ...textSize['11'], fontFamily: fonts.sans.bold, color: colors.mutedForeground, textTransform: 'uppercase' },
  segment: {
    flex: 1,
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.full },
  segmentActive: { backgroundColor: colors.card, ...shadow.sm },
  segmentText: { ...textSize.xs, fontFamily: fonts.sans.semibold, color: colors.mutedForeground },
  segmentTextActive: { color: colors.foreground, fontFamily: fonts.sans.bold },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  lockButtonOn: { backgroundColor: colors.foreground, borderColor: colors.foreground },
  lockText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.foreground },
  textPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  textPillLabel: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.foreground },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...textSize['10'], fontFamily: fonts.sans.bold, color: colors.primaryForeground },
  modePillText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.primaryForeground },
  hostPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  hostPillText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.foreground },
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
  postRideChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.3),
    backgroundColor: withAlpha(colors.accent, 0.1),
  },
  postRideChipText: { ...textSize.xs, fontFamily: fonts.mono.bold, color: colors.accent },
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
  // The moderator panel adds a row above the controls.
  chatWrapHost: { bottom: 108 },
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
});
