import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
        <AvatarGrid members={session.members} notice={!lk ? 'Video needs the Rideshare Chats app build' : 'Video is not configured on the server'} />
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
      <LiveGrid members={session.members} renderControls={renderControls} />
    </LiveKitRoom>
  );
}

function LiveGrid({ members, renderControls }: { members: RoomMember[]; renderControls: Props['renderControls'] }) {
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

  return (
    <View style={styles.flex}>
      <Grid
        count={tiles.length}
        renderTile={(i) => {
          const { ref, member } = tiles[i]!;
          const isSelf = member?.isSelf ?? ref.participant.isLocal;
          const hasVideo = isTrackReference(ref) && !ref.publication.isMuted;
          return (
            <Tile
              key={ref.participant.identity}
              member={member}
              name={member?.displayName ?? (ref.participant.name || 'Rider')}
              isSelf={isSelf}
              speaking={speaking.has(ref.participant.identity)}
            >
              {hasVideo ? (
                <VideoTrack trackRef={ref} style={StyleSheet.absoluteFill} objectFit="cover" mirror={isSelf} />
              ) : null}
            </Tile>
          );
        }}
      />
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

function AvatarGrid({ members, notice }: { members: RoomMember[]; notice: string }) {
  return (
    <View style={styles.flex}>
      <Grid
        count={members.length}
        renderTile={(i) => {
          const m = members[i]!;
          return <Tile key={m.uid} member={m} name={m.displayName} isSelf={m.isSelf} speaking={false} />;
        }}
      />
      <View style={styles.notice}>
        <Icon name="solarVideocameraBold" size={14} color={colors.mutedForeground} />
        <Text style={styles.noticeText}>{notice}</Text>
      </View>
    </View>
  );
}

/** 3-column grid filling the available height. */
function Grid({ count, renderTile }: { count: number; renderTile: (index: number) => React.ReactNode }) {
  const rows = Math.max(1, Math.ceil(count / 3));
  return (
    <View style={styles.grid}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.gridRow}>
          {Array.from({ length: 3 }, (_, col) => {
            const index = row * 3 + col;
            return index < count ? renderTile(index) : <View key={`empty-${index}`} style={styles.emptyTile} />;
          })}
        </View>
      ))}
    </View>
  );
}

function Tile({
  member,
  name,
  isSelf,
  speaking,
  children,
}: {
  member: RoomMember | undefined;
  name: string;
  isSelf: boolean;
  speaking: boolean;
  children?: React.ReactNode;
}) {
  const ring = speaking ? (isSelf ? colors.primary : colors.accent) : null;
  const label = `${isSelf ? 'You' : name}${member?.homeCity ? ` (${shortCity(member.homeCity)})` : ''}`;
  return (
    <View style={styles.tile}>
      {member?.photoUrl ? (
        <Image source={{ uri: member.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={styles.tilePlaceholder}>
          <Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      {children}
      {ring ? <View style={[styles.ring, { borderColor: ring }]} /> : null}
      <View style={styles.tileFooter}>
        <View style={styles.nameTag}>
          <Text style={[styles.nameText, isSelf && styles.nameSelf]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
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
  grid: { flex: 1, gap: 8 },
  gridRow: { flex: 1, flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTile: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: withAlpha(colors.secondary, 0.6),
  },
  tilePlaceholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  initial: { ...textSize['2xl'], fontFamily: fonts.heading.bold, color: colors.mutedForeground },
  ring: { ...StyleSheet.absoluteFill, borderWidth: 2, borderRadius: radius.xl },
  tileFooter: { position: 'absolute', left: 6, right: 6, bottom: 6, flexDirection: 'row' },
  nameTag: { backgroundColor: withAlpha(colors.black, 0.75), paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.xs, flexShrink: 1 },
  nameText: { ...textSize['10'], fontFamily: fonts.sans.medium, color: colors.white },
  nameSelf: { fontFamily: fonts.sans.bold },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 6 },
  noticeText: { ...textSize['10'], fontFamily: fonts.sans.medium, color: colors.mutedForeground },
});
