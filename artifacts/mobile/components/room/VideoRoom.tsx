import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import * as Device from 'expo-device';
import type { RoomMember, RoomSession } from '@workspace/api-client-react';
import type { DisconnectReason, Participant } from 'livekit-client';
import { colors, withAlpha } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { vibeOption } from '@/constants/vibes';
import { Icon, Pulse } from '@/components/ui';
import type { IconName } from '@/constants/icons';
import { getLiveKit } from '@/lib/livekit';
import { useTripStore } from '@/stores/trip.store';

export type MediaControls = {
  available: boolean;
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
};

export type ModerationAction = 'eject' | 'mute' | 'flag';

/**
 * Why this device's video stopped for good (no reconnect):
 * removed = the server took this account out of the room (left, ejected, or joined another room on
 * another device); duplicate = the same account connected to this room from another device;
 * closed = the room ended.
 */
export type VideoEndReason = 'removed' | 'duplicate' | 'closed';

/** Host Moderation Toolkit: only passed when the viewer hosts the room. */
export type Moderation = {
  onAction: (uid: string, action: ModerationAction) => Promise<void>;
};

type Props = {
  session: RoomSession;
  /** Rendered inside the LiveKit context so it can drive the local mic/camera. */
  renderControls: (controls: MediaControls) => React.ReactNode;
  onVideoError?: (message: string) => void;
  /** Video stopped for good on this device (see VideoEndReason); the screen decides what's next. */
  onVideoEnded?: (reason: VideoEndReason) => void;
  moderation?: Moderation;
  /** Extra actions on another rider's full-screen view (e.g. Follow). */
  renderFocusActions?: (member: RoomMember) => React.ReactNode;
};

/** Shared by the live and avatar grids. */
type GridOptions = {
  capacity: number;
  accent: string;
  closed: boolean;
  moderation?: Moderation;
  renderFocusActions?: Props['renderFocusActions'];
};

const NO_MEDIA: MediaControls = { available: false, micOn: false, camOn: false, toggleMic: () => {}, toggleCam: () => {} };

/** Stable across renders: LiveKitRoom compares `options` by value but reconnects when callbacks change. */
const ROOM_OPTIONS = { adaptiveStream: true, dynacast: true };

/**
 * Emulators usually can't do direct UDP to the media server, so the peer connection keeps failing
 * and rejoining. There, send media through LiveKit's TURN relay. Real phones connect directly.
 */
const CONNECT_OPTIONS = Device.isDevice ? undefined : { rtcConfig: { iceTransportPolicy: 'relay' as const } };

const END_NOTICE: Record<VideoEndReason, string> = {
  removed: 'Video ended on this device',
  duplicate: 'Your account is in this room on another device',
  closed: 'This room has ended',
};

/** Live video grid for a R.O.O.M.; falls back to avatar tiles where WebRTC isn't available. */
export function VideoRoom({ session, renderControls, onVideoError, onVideoEnded, moderation, renderFocusActions }: Props) {
  const lk = getLiveKit();
  const token = session.livekit?.token;
  // Once the server has removed this device, its video pass is revoked: stop instead of retrying.
  const [ended, setEnded] = useState<VideoEndReason | null>(null);
  useEffect(() => setEnded(null), [session.roomId, token]);

  // LiveKitRoom re-runs `room.connect()` whenever these callbacks change identity, so they must be
  // stable; the latest props are read through refs.
  const errorRef = useRef(onVideoError);
  const endedRef = useRef(onVideoEnded);
  errorRef.current = onVideoError;
  endedRef.current = onVideoEnded;
  const end = useCallback((reason: VideoEndReason) => {
    setEnded((current) => current ?? reason);
    endedRef.current?.(reason);
  }, []);
  const handleError = useCallback(
    (error: Error) => {
      if (/revoked|participant removed|room.*(deleted|closed)/i.test(error.message)) end('removed');
      else errorRef.current?.(error.message);
    },
    [end],
  );
  const handleDisconnected = useCallback(
    (reason?: DisconnectReason) => {
      const R = getLiveKit()?.client.DisconnectReason;
      if (!R || reason == null) return;
      if (reason === R.DUPLICATE_IDENTITY) end('duplicate');
      else if (reason === R.PARTICIPANT_REMOVED) end('removed');
      else if (reason === R.ROOM_DELETED || reason === R.ROOM_CLOSED) end('closed');
    },
    [end],
  );

  const grid: GridOptions = {
    capacity: session.capacity,
    // Speaking borders use the room's mood colour.
    accent: vibeOption(session.vibe).color,
    // Manual matching or Privacy Lock: empty seats are closed to new riders.
    closed: session.locked || session.matching === 'manual',
    moderation,
    renderFocusActions,
  };
  if (!lk || !session.livekit || ended) {
    let notice = 'Video is not configured on the server';
    if (!lk) notice = 'Video needs the Rideshare Chats app build';
    else if (ended) notice = END_NOTICE[ended];
    return (
      <View style={styles.flex}>
        <AvatarGrid members={session.members} grid={grid} notice={notice} />
        {renderControls(NO_MEDIA)}
      </View>
    );
  }
  const { LiveKitRoom } = lk.rn;
  return (
    <LiveKitRoom
      serverUrl={session.livekit.url}
      token={session.livekit.token}
      connect
      audio
      video
      options={ROOM_OPTIONS}
      connectOptions={CONNECT_OPTIONS}
      onError={handleError}
      onDisconnected={handleDisconnected}
    >
      <LiveGrid members={session.members} grid={grid} renderControls={renderControls} />
    </LiveKitRoom>
  );
}

function LiveGrid({
  members,
  grid,
  renderControls,
}: {
  members: RoomMember[];
  grid: GridOptions;
  renderControls: Props['renderControls'];
}) {
  const lk = getLiveKit()!;
  const { useTracks, useSpeakingParticipants, useLocalParticipant, isTrackReference, VideoTrack, AudioSession } = lk.rn;
  const { Track } = lk.client;

  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, [AudioSession]);

  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  const speaking = new Set(useSpeakingParticipants().map((p) => p.identity));
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const byUid = useMemo(() => new Map(members.map((m) => [m.uid, m])), [members]);
  const toggleMic = () => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);

  // Host force-mute: turn the local mic off (the server mutes the track too). Only notices that
  // arrive while this room is open count, so an old one never mutes a fresh room.
  const forceMutedAt = useTripStore((s) => s.forceMutedAt);
  const openedAt = useRef(Date.now());
  useEffect(() => {
    if (forceMutedAt != null && forceMutedAt >= openedAt.current) void localParticipant.setMicrophoneEnabled(false);
  }, [forceMutedAt, localParticipant]);

  const tiles = tracks
    .map((ref) => ({ ref, member: byUid.get(ref.participant.identity) }))
    .sort((a, b) => Number(b.member?.isSelf ?? false) - Number(a.member?.isSelf ?? false));

  const items: TileItem[] = tiles.map(({ ref, member }) => {
    const isSelf = member?.isSelf ?? ref.participant.isLocal;
    const hasVideo = isTrackReference(ref) && !ref.publication.isMuted;
    return {
      key: ref.participant.identity,
      member,
      name: member?.displayName ?? (ref.participant.name || 'Rider'),
      isSelf,
      speaking: speaking.has(ref.participant.identity),
      micBadge: <MicBadge participant={ref.participant} onToggle={isSelf ? toggleMic : undefined} />,
      renderVideo: hasVideo
        ? (fit) => <VideoTrack trackRef={ref} style={StyleSheet.absoluteFill} objectFit={fit} mirror={isSelf} />
        : undefined,
    };
  });

  return (
    <View style={styles.flex}>
      <TileGrid items={items} grid={grid} />
      <ConnectionPill />
      {renderControls({
        available: true,
        micOn: isMicrophoneEnabled,
        camOn: isCameraEnabled,
        toggleMic,
        toggleCam: () => void localParticipant.setCameraEnabled(!isCameraEnabled),
      })}
    </View>
  );
}

/** Shown while LiveKit is (re)connecting, so a shaky connection is visible instead of silent. */
function ConnectionPill() {
  const lk = getLiveKit()!;
  const state = lk.rn.useConnectionState();
  const { ConnectionState } = lk.client;
  if (state !== ConnectionState.Reconnecting && state !== ConnectionState.SignalReconnecting && state !== ConnectionState.Connecting) {
    return null;
  }
  return (
    <View style={styles.connection} pointerEvents="none" accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={colors.white} />
      <Text style={styles.connectionText}>{state === ConnectionState.Connecting ? 'Connecting video…' : 'Reconnecting video…'}</Text>
    </View>
  );
}

/** Live mic state on a tile; on your own tile it is also the mute toggle. */
function MicBadge({ participant, onToggle }: { participant: Participant; onToggle?: () => void }) {
  const lk = getLiveKit()!;
  const { Track } = lk.client;
  const muted = lk.rn.useIsMuted({ participant, source: Track.Source.Microphone });
  const icon = muted ? 'mdiMicrophoneOff' : 'mdiMicrophone';
  const badge = (
    <View style={[styles.micBadge, muted && styles.micBadgeMuted]}>
      <Icon name={icon} size={onToggle ? 16 : 13} color={colors.white} />
    </View>
  );
  if (!onToggle) return badge;
  return (
    <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="button" accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}>
      {badge}
    </Pressable>
  );
}

function AvatarGrid({ members, grid, notice }: { members: RoomMember[]; grid: GridOptions; notice: string }) {
  const items: TileItem[] = members.map((m) => ({
    key: m.uid,
    member: m,
    name: m.displayName,
    isSelf: m.isSelf,
    speaking: false,
  }));
  return (
    <View style={styles.flex}>
      <TileGrid items={items} grid={grid} />
      <View style={styles.notice}>
        <Icon name="solarVideocameraBold" size={14} color={colors.mutedForeground} />
        <Text style={styles.noticeText}>{notice}</Text>
      </View>
    </View>
  );
}

type VideoFit = 'cover' | 'contain';

type TileItem = {
  key: string;
  member: RoomMember | undefined;
  name: string;
  isSelf: boolean;
  speaking: boolean;
  /** Mic on/off badge (live video only). */
  micBadge?: React.ReactNode;
  /** Absent while the camera is off or video isn't available (the avatar shows instead). */
  renderVideo?: (fit: VideoFit) => React.ReactNode;
};

const GAP = 8;
/** Height kept free below the grid for the collapsed chat bar that floats over the bottom of the stage. */
const CHAT_CLEARANCE = 64;
const MIN_TILE = 72;
/** Preferred width ÷ height of a tile (portrait, like a phone video). */
const TARGET_ASPECT = 0.75;
/** Tiles never get taller than this many times their width. */
const MAX_HEIGHT_RATIO = 1.7;

/**
 * Splits width × height into the column count whose tiles are closest to portrait 3:4 while every
 * slot still fits, so the grid fills the stage in both directions instead of stopping at a square.
 */
function fitGrid(slots: number, width: number, height: number): { cols: number; w: number; h: number } {
  let best: { cols: number; w: number; h: number; score: number } | null = null;
  for (let cols = 1; cols <= slots; cols++) {
    const rows = Math.ceil(slots / cols);
    const w = (width - GAP * (cols - 1)) / cols;
    const h = Math.min((height - GAP * (rows - 1)) / rows, w * MAX_HEIGHT_RATIO);
    if (w < MIN_TILE || h < MIN_TILE) continue;
    const score = Math.abs(Math.log(w / h / TARGET_ASPECT));
    if (!best || score < best.score) best = { cols, w, h, score };
  }
  if (!best) {
    // Very small stage: fall back to the largest square that still fits.
    const cols = Math.min(slots, 3);
    const rows = Math.ceil(slots / cols);
    const size = Math.max(MIN_TILE, Math.floor(Math.min((width - GAP * (cols - 1)) / cols, (height - GAP * (rows - 1)) / rows)));
    return { cols, w: size, h: size };
  }
  return { cols: best.cols, w: Math.floor(best.w), h: Math.floor(best.h) };
}

/** Every seat is a tile sized to fill the screen with no scrolling; tap a rider to view them full screen. */
function TileGrid({ items, grid }: { items: TileItem[]; grid: GridOptions }) {
  const { capacity, accent, closed, moderation, renderFocusActions } = grid;
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  // The menu closes when that rider leaves.
  const menuItem = items.find((item) => item.key === menuKey && item.member) ?? null;
  const focused = items.find((item) => item.key === focusKey) ?? null;
  const slots = Math.max(capacity, items.length);
  const { cols, w, h } = box.width > 0 ? fitGrid(slots, box.width, box.height - CHAT_CLEARANCE) : { cols: 1, w: 0, h: 0 };
  const gridWidth = cols * w + GAP * (cols - 1);

  return (
    <View style={styles.flex} onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      {focused ? (
        <View style={styles.flex}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
            {items.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => setFocusKey(item.key)}
                accessibilityLabel={`View ${item.isSelf ? 'yourself' : item.name}`}
                style={[styles.stripTile, item.key === focused.key && styles.stripTileActive]}
              >
                <Tile item={item} accent={accent} compact />
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.focusStage}>
            <Tile item={focused} accent={accent} fit="contain" focus />
            {renderFocusActions && focused.member && !focused.isSelf ? (
              <View style={styles.focusActions} pointerEvents="box-none">
                {renderFocusActions(focused.member)}
              </View>
            ) : null}
            {moderation && focused.member && !focused.isSelf ? (
              <View style={styles.focusModeration} pointerEvents="box-none">
                <View style={styles.focusModerationBar}>
                  <ModerationActions
                    key={focused.key}
                    name={focused.name}
                    compact={false}
                    onAction={(action) => moderation.onAction(focused.member!.uid, action)}
                    onDone={(action) => {
                      // An ejected rider's tile is gone; go back to the grid.
                      if (action === 'eject') setFocusKey(null);
                    }}
                  />
                </View>
              </View>
            ) : null}
            <Pressable style={styles.closeFocus} onPress={() => setFocusKey(null)} accessibilityLabel="Back to grid">
              <Icon name="solarCloseCircleLinear" size={26} color={colors.white} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.gridWrap, { width: gridWidth }]}>
          {w > 0
            ? Array.from({ length: slots }, (_, i) => {
                const item = items[i];
                if (!item) {
                  return closed ? (
                    <View key={`empty-${i}`} style={[styles.closedTile, { width: w, height: h }]}>
                      <Icon name="solarLockKeyholeBold" size={Math.round(Math.min(w, h) * 0.2)} color={withAlpha(colors.white, 0.6)} />
                      <Text style={styles.closedText}>Closed</Text>
                    </View>
                  ) : (
                    <View key={`empty-${i}`} style={[styles.emptyTile, { width: w, height: h }]}>
                      <Icon name="solarUsersGroupTwoRoundedBold" size={Math.round(Math.min(w, h) * 0.25)} color={colors.mutedForeground} />
                      <Text style={styles.emptyText}>Waiting…</Text>
                    </View>
                  );
                }
                const canModerate = Boolean(moderation && !item.isSelf && item.member);
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setFocusKey(item.key)}
                    onLongPress={canModerate ? () => setMenuKey(item.key) : undefined}
                    delayLongPress={350}
                    accessibilityLabel={`Open ${item.isSelf ? 'your video' : item.name} full screen`}
                    accessibilityHint={canModerate ? 'Long-press for host controls' : undefined}
                    style={{ width: w, height: h }}
                  >
                    <Tile item={item} accent={accent} />
                    {moderation && menuItem?.key === item.key ? (
                      <ModerationMenu
                        name={item.name}
                        compact={w < 120}
                        onClose={() => setMenuKey(null)}
                        onAction={(action) => moderation.onAction(item.member!.uid, action)}
                      />
                    ) : null}
                  </Pressable>
                );
              })
            : null}
        </View>
      )}
    </View>
  );
}

function Tile({
  item,
  accent,
  fit = 'cover',
  compact = false,
  focus = false,
}: {
  item: TileItem;
  accent: string;
  fit?: VideoFit;
  compact?: boolean;
  /** Full-screen view: the mic badge moves left of the close button. */
  focus?: boolean;
}) {
  const { member, name, isSelf, speaking } = item;
  const label = `${isSelf ? 'You' : name}${member?.homeCity && !compact ? ` (${shortCity(member.homeCity)})` : ''}`;
  const video = item.renderVideo?.(fit);
  return (
    <View style={styles.tile}>
      {member?.photoUrl ? (
        <Image source={{ uri: member.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={styles.tilePlaceholder}>
          <Text style={[styles.initial, compact && styles.initialCompact]}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      {video}
      {speaking ? <Pulse style={[styles.ring, { borderColor: accent }]} /> : null}
      {compact || !item.micBadge ? null : <View style={[styles.micSlot, focus && styles.micSlotFocus]}>{item.micBadge}</View>}
      {compact ? null : (
        <View style={styles.tileFooter}>
          <View style={styles.nameTag}>
            <Text style={[styles.nameText, isSelf && styles.nameSelf]} numberOfLines={1}>
              {label}
            </Text>
          </View>
          {member?.isHost ? (
            <View style={[styles.hostTag, { backgroundColor: accent }]}>
              <Text style={styles.hostText}>HOST</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const MENU_ACTIONS: { action: ModerationAction; icon: IconName; label: string; tint: string }[] = [
  { action: 'eject', icon: 'mdiAccountRemove', label: 'Eject', tint: colors.destructive },
  { action: 'mute', icon: 'mdiMicrophoneOff', label: 'Mute', tint: colors.white },
  { action: 'flag', icon: 'mdiFlag', label: 'Flag', tint: colors.amber400 },
];

/** Long-press host overlay on a rider's tile: Eject (tap twice), Force-Mute, Silent Flag. */
function ModerationMenu({
  name,
  compact,
  onAction,
  onClose,
}: {
  name: string;
  compact: boolean;
  onAction: (action: ModerationAction) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <Pressable style={styles.menu} onPress={onClose} accessibilityLabel={`Close host controls for ${name}`}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.menuDim} />
      <ModerationActions name={name} compact={compact} onAction={onAction} onDone={onClose} />
    </Pressable>
  );
}

/** Eject (tap twice), Force-Mute and Silent Flag buttons; used by the tile menu and the full-screen view. */
function ModerationActions({
  name,
  compact,
  onAction,
  onDone,
}: {
  name: string;
  compact: boolean;
  onAction: (action: ModerationAction) => Promise<void>;
  /** After an action succeeds. */
  onDone: (action: ModerationAction) => void;
}) {
  const [confirmEject, setConfirmEject] = useState(false);
  const [busy, setBusy] = useState<ModerationAction | null>(null);

  // A bumpy ride shouldn't eject anyone: the confirmation expires after a few seconds.
  useEffect(() => {
    if (!confirmEject) return;
    const timer = setTimeout(() => setConfirmEject(false), 3_000);
    return () => clearTimeout(timer);
  }, [confirmEject]);

  const run = async (action: ModerationAction) => {
    if (busy) return;
    if (action === 'eject' && !confirmEject) {
      setConfirmEject(true);
      return;
    }
    setBusy(action);
    try {
      await onAction(action);
      onDone(action);
    } catch {
      // The room screen shows the error; keep the buttons up to retry.
    } finally {
      setBusy(null);
    }
  };

  const size = compact ? 30 : 36;
  return (
    <View style={styles.menuRow}>
      {MENU_ACTIONS.map(({ action, icon, label, tint }) => {
        const confirming = action === 'eject' && confirmEject;
        return (
          <Pressable
            key={action}
            onPress={() => void run(action)}
            hitSlop={4}
            style={styles.menuItem}
            accessibilityRole="button"
            accessibilityLabel={confirming ? `Tap again to eject ${name}` : `${label} ${name}`}
          >
            <View
              style={[
                styles.menuButton,
                { width: size, height: size, borderColor: withAlpha(tint, 0.6) },
                confirming && { backgroundColor: colors.destructive, borderColor: colors.destructive },
              ]}
            >
              {busy === action ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Icon name={icon} size={compact ? 15 : 18} color={confirming ? colors.white : tint} />
              )}
            </View>
            <Text style={[styles.menuLabel, confirming && { color: colors.white }]} numberOfLines={1}>
              {confirming ? 'Sure?' : label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "San Francisco, CA" → "CA"; otherwise the first word. */
function shortCity(city: string): string {
  const parts = city.split(',').map((p) => p.trim());
  return parts.length > 1 ? parts[parts.length - 1]!.slice(0, 3).toUpperCase() : parts[0]!.slice(0, 10);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, alignSelf: 'center' },
  emptyTile: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: withAlpha(colors.secondary, 0.6),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyText: { ...textSize['10'], fontFamily: fonts.sans.medium, color: colors.mutedForeground },
  closedTile: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.08),
    backgroundColor: withAlpha(colors.foreground, 0.88),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  closedText: { ...textSize['10'], fontFamily: fonts.sans.semibold, color: withAlpha(colors.white, 0.6) },
  menu: { ...StyleSheet.absoluteFill, borderRadius: radius.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  menuDim: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(colors.black, 0.35) },
  menuRow: { flexDirection: 'row', gap: 4 },
  menuItem: { alignItems: 'center', gap: 3, minWidth: 30 },
  menuButton: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.black, 0.35),
  },
  menuLabel: { ...textSize['10'], fontFamily: fonts.sans.bold, color: withAlpha(colors.white, 0.9) },
  strip: { flexGrow: 0, marginBottom: GAP },
  stripContent: { gap: GAP },
  stripTile: { width: 56, height: 56, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  stripTileActive: { borderColor: colors.primary },
  focusStage: { flex: 1 },
  // Clear of the close button and the mic badge beside it (top right).
  focusActions: { position: 'absolute', top: 8, left: 8, right: 80, alignItems: 'flex-start' },
  // Host controls sit just above the chat bar that floats over the bottom of the stage.
  focusModeration: { position: 'absolute', left: 0, right: 0, bottom: CHAT_CLEARANCE + 8, alignItems: 'center' },
  focusModerationBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.black, 0.55),
  },
  closeFocus: { position: 'absolute', top: 8, right: 8, borderRadius: radius.full, backgroundColor: withAlpha(colors.black, 0.45) },
  tile: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tilePlaceholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  initial: { ...textSize['2xl'], fontFamily: fonts.heading.bold, color: colors.mutedForeground },
  initialCompact: { ...textSize.base },
  ring: { ...StyleSheet.absoluteFill, borderWidth: 3, borderRadius: radius.xl },
  micSlot: { position: 'absolute', top: 6, right: 6 },
  // Left of the 26px close button at top 8 / right 8.
  micSlotFocus: { top: 8, right: 44 },
  micBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 5,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.black, 0.6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBadgeMuted: { backgroundColor: withAlpha(colors.destructive, 0.85) },
  tileFooter: { position: 'absolute', left: 6, right: 6, bottom: 6, flexDirection: 'row' },
  nameTag: { backgroundColor: withAlpha(colors.black, 0.75), paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs, flexShrink: 1 },
  nameText: { ...textSize['10'], fontFamily: fonts.sans.medium, color: colors.white },
  nameSelf: { fontFamily: fonts.sans.bold },
  hostTag: { marginLeft: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: radius.xs, justifyContent: 'center' },
  hostText: { ...textSize['10'], fontFamily: fonts.sans.bold, color: colors.white, letterSpacing: 0.5 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 6 },
  connection: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.chart3, 0.92),
  },
  connectionText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.white },
  noticeText: { ...textSize['10'], fontFamily: fonts.sans.medium, color: colors.mutedForeground },
});
