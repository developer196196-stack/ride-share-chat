import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { RoomMember, RoomSession } from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Icon } from '@/components/ui';
import { getLiveKit } from '@/lib/livekit';

export type MediaControls = {
  available: boolean;
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
};

type Props = {
  session: RoomSession;
  /** Rendered inside the LiveKit context so it can drive the local mic/camera. */
  renderControls: (controls: MediaControls) => React.ReactNode;
  onVideoError?: (message: string) => void;
};

const NO_MEDIA: MediaControls = { available: false, micOn: false, camOn: false, toggleMic: () => {}, toggleCam: () => {} };

/** Live video grid for a R.O.O.M.; falls back to avatar tiles where WebRTC isn't available. */
export function VideoRoom({ session, renderControls, onVideoError }: Props) {
  const lk = getLiveKit();
  if (!lk || !session.livekit) {
    return (
      <View style={styles.flex}>
        <AvatarGrid members={session.members} capacity={session.capacity} notice={!lk ? 'Video needs the Rideshare Chats app build' : 'Video is not configured on the server'} />
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
      options={{ adaptiveStream: true, dynacast: true }}
      onError={(error) => onVideoError?.(error.message)}
    >
      <LiveGrid members={session.members} capacity={session.capacity} renderControls={renderControls} />
    </LiveKitRoom>
  );
}

function LiveGrid({
  members,
  capacity,
  renderControls,
}: {
  members: RoomMember[];
  capacity: number;
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
      renderVideo: hasVideo
        ? (fit) => <VideoTrack trackRef={ref} style={StyleSheet.absoluteFill} objectFit={fit} mirror={isSelf} />
        : undefined,
    };
  });

  return (
    <View style={styles.flex}>
      <TileGrid items={items} capacity={capacity} />
      {renderControls({
        available: true,
        micOn: isMicrophoneEnabled,
        camOn: isCameraEnabled,
        toggleMic: () => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled),
        toggleCam: () => void localParticipant.setCameraEnabled(!isCameraEnabled),
      })}
    </View>
  );
}

function AvatarGrid({ members, capacity, notice }: { members: RoomMember[]; capacity: number; notice: string }) {
  const items: TileItem[] = members.map((m) => ({
    key: m.uid,
    member: m,
    name: m.displayName,
    isSelf: m.isSelf,
    speaking: false,
  }));
  return (
    <View style={styles.flex}>
      <TileGrid items={items} capacity={capacity} />
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
function TileGrid({ items, capacity }: { items: TileItem[]; capacity: number }) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [focusKey, setFocusKey] = useState<string | null>(null);
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
                <Tile item={item} compact />
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.focusStage}>
            <Tile item={focused} fit="contain" />
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
                  return (
                    <View key={`empty-${i}`} style={[styles.emptyTile, { width: w, height: h }]}>
                      <Icon name="solarUsersGroupTwoRoundedBold" size={Math.round(Math.min(w, h) * 0.25)} color={colors.mutedForeground} />
                      <Text style={styles.emptyText}>Waiting…</Text>
                    </View>
                  );
                }
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setFocusKey(item.key)}
                    accessibilityLabel={`Open ${item.isSelf ? 'your video' : item.name} full screen`}
                    style={{ width: w, height: h }}
                  >
                    <Tile item={item} />
                  </Pressable>
                );
              })
            : null}
        </View>
      )}
    </View>
  );
}

function Tile({ item, fit = 'cover', compact = false }: { item: TileItem; fit?: VideoFit; compact?: boolean }) {
  const { member, name, isSelf, speaking } = item;
  const ring = speaking ? (isSelf ? colors.primary : colors.accent) : null;
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
      {ring ? <View style={[styles.ring, { borderColor: ring }]} /> : null}
      {compact ? null : (
        <View style={styles.tileFooter}>
          <View style={styles.nameTag}>
            <Text style={[styles.nameText, isSelf && styles.nameSelf]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>
      )}
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
  strip: { flexGrow: 0, marginBottom: GAP },
  stripContent: { gap: GAP },
  stripTile: { width: 56, height: 56, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  stripTileActive: { borderColor: colors.primary },
  focusStage: { flex: 1 },
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
  ring: { ...StyleSheet.absoluteFill, borderWidth: 2, borderRadius: radius.xl },
  tileFooter: { position: 'absolute', left: 6, right: 6, bottom: 6, flexDirection: 'row' },
  nameTag: { backgroundColor: withAlpha(colors.black, 0.75), paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs, flexShrink: 1 },
  nameText: { ...textSize['10'], fontFamily: fonts.sans.medium, color: colors.white },
  nameSelf: { fontFamily: fonts.sans.bold },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 6 },
  noticeText: { ...textSize['10'], fontFamily: fonts.sans.medium, color: colors.mutedForeground },
});
