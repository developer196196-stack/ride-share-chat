/**
 * Discovery Grid (client doc 2) — the home screen after trip validation.
 * A 3×3 grid of live Rolling Rooms (blurred host preview, mood tag, occupancy) and a floating
 * dock: Host a Room (open your own room as moderator) or Join a Room (quick match by mood).
 * Tapping a room card drops the rider into that specific room.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getListDiscoverRoomsQueryKey,
  useHostRoom,
  useJoinRoomById,
  useListDiscoverRooms,
  type DiscoverRoom,
  type Vibe,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow, tintedShadow } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { VIBE_OPTIONS, vibeOption } from '@/constants/vibes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { ErrorBanner, Icon, LiveDot, OptionSheet, Screen, type Option } from '@/components/ui';
import { BottomTabBar, LogoTile } from '@/components/rideshare';
import { SafetyFab } from '@/components/safety/SafetyFab';
import { FriendsStrip } from '@/components/social/FriendsStrip';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useAuthStore } from '@/stores/auth.store';
import { useTripStore } from '@/stores/trip.store';

const GRID_SLOTS = 9;
const GAP = 8;
/** Space the floating dock needs above the tab bar. */
const DOCK_CLEARANCE = 132;
const TAB_BAR_HEIGHT = 72;

/** "Party Mode" → "#PartyMode". */
const moodTag = (vibe: Vibe) => `#${vibeOption(vibe).label.replace(/\s+/g, '')}`;
const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

const HOST_OPTIONS: Option<Vibe>[] = VIBE_OPTIONS.map((v) => ({
  value: v.value,
  label: v.headline,
  leading: <Icon name={v.icon} size={18} color={v.color} />,
  trailing: moodTag(v.value),
}));

function RoomCard({
  room,
  size,
  joining,
  disabled,
  onPress,
}: {
  room: DiscoverRoom;
  size: { w: number; h: number };
  joining: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const mood = vibeOption(room.vibe);
  const host = room.host;
  const seatsLeft = room.capacity - room.memberCount;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Join ${host ? `${host.displayName}'s` : 'this'} ${mood.label} room, ${room.memberCount} of ${room.capacity} seats filled`}
      style={({ pressed }) => [styles.card, { width: size.w, height: size.h }, pressed && styles.cardPressed]}
    >
      {host?.photoUrl ? (
        <Image source={{ uri: host.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={14} />
      ) : (
        <LinearGradient colors={[withAlpha(mood.color, 0.85), withAlpha(colors.foreground, 0.9)]} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={['transparent', withAlpha(colors.black, 0.25), withAlpha(colors.black, 0.8)]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.moodTag, { backgroundColor: withAlpha(mood.color, 0.9) }]}>
        <Text style={styles.moodTagText} numberOfLines={1}>
          {moodTag(room.vibe)}
        </Text>
      </View>
      <View style={styles.cardCenter}>
        <View style={[styles.avatar, { borderColor: mood.color }]}>
          {host?.photoUrl ? (
            <Image source={{ uri: host.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Text style={styles.avatarInitial}>{(host?.displayName ?? '?').slice(0, 1).toUpperCase()}</Text>
          )}
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.hostName} numberOfLines={1}>
          {host ? firstName(host.displayName) : 'Rider'}
        </Text>
        <View style={styles.occupancy}>
          <LiveDot size={6} color={colors.accent} />
          <Text style={styles.occupancyText}>
            {room.memberCount}/{room.capacity}
          </Text>
          <Text style={styles.seatsText} numberOfLines={1}>
            · {seatsLeft} open
          </Text>
        </View>
      </View>
      {joining ? (
        <View style={styles.joining}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : null}
    </Pressable>
  );
}

function OpenSlot({ size, onPress, disabled }: { size: { w: number; h: number }; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Host a new room"
      style={({ pressed }) => [styles.slot, { width: size.w, height: size.h }, pressed && styles.cardPressed]}
    >
      <Icon name="solarUsersGroupTwoRoundedBold" size={Math.round(size.w * 0.24)} color={colors.mutedForeground} />
      <Text style={styles.slotText}>Host one</Text>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const state = useTripStore((s) => s.snapshot?.state);
  const currentRoom = useTripStore((s) => s.room);
  const grid = useListDiscoverRooms({
    query: { queryKey: getListDiscoverRoomsQueryKey(), enabled: isAuthenticated, refetchInterval: 5_000 },
  });
  const hostRoom = useHostRoom();
  const joinRoom = useJoinRoomById();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [hostOpen, setHostOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

  const verified = state === 'VERIFIED';
  const busy = hostRoom.isPending || joinRoom.isPending;
  const rooms = grid.data?.rooms ?? [];
  const liveRooms = grid.data?.liveRooms ?? 0;
  const cardW = gridWidth > 0 ? Math.floor((gridWidth - GAP * 2) / 3) : 0;
  const size = { w: cardW, h: Math.round(cardW * 1.28) };

  const enter = (session: Parameters<ReturnType<typeof useTripStore.getState>['setRoom']>[0]) => {
    useTripStore.getState().setRoom(session);
    router.push(routes.activeRoom);
  };

  const join = async (room: DiscoverRoom) => {
    setError(null);
    setJoiningId(room.roomId);
    try {
      enter(await joinRoom.mutateAsync({ roomId: room.roomId }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not join that R.O.O.M.'));
      void queryClient.invalidateQueries({ queryKey: getListDiscoverRoomsQueryKey() });
    } finally {
      setJoiningId(null);
    }
  };

  const host = async (vibe: Vibe) => {
    setHostOpen(false);
    setError(null);
    try {
      enter(await hostRoom.mutateAsync({ data: { vibe } }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not open your R.O.O.M.'));
    }
  };

  return (
    <View style={styles.root}>
      <Screen
        contentStyle={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + DOCK_CLEARANCE + insets.bottom }]}
        edges={['top']}
        footer={<BottomTabBar active="home" />}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LogoTile size={48} padding={5} rounded="2xl" elevation="sm" />
            <View>
              <Text style={styles.title}>Rolling Rooms</Text>
              <View style={styles.liveRow}>
                <LiveDot size={6} color={liveRooms > 0 ? colors.accent : colors.slate400} pulse={liveRooms > 0} />
                <Text style={styles.subtitle}>
                  {grid.isLoading ? 'Finding live rooms…' : `${liveRooms} live across the country`}
                </Text>
              </View>
            </View>
          </View>
          <Pressable
            onPress={() => router.push(routes.validation)}
            style={[styles.verified, !verified && styles.notVerified]}
            accessibilityLabel={verified ? 'Trip verified' : 'Trip not verified yet — open Trip Validation'}
          >
            <Icon name="solarShieldCheckBold" size={14} color={verified ? colors.accent : colors.chart3} />
            <Text style={[styles.verifiedText, !verified && { color: colors.chart3 }]}>{verified ? 'Verified' : 'Verify'}</Text>
          </Pressable>
        </View>

        {currentRoom ? (
          <Pressable style={styles.returnBanner} onPress={() => router.push(routes.activeRoom)}>
            <LiveDot size={8} />
            <Text style={styles.returnText}>You're in {vibeOption(currentRoom.vibe).label} · Return to your R.O.O.M.</Text>
            <Icon name="solarAltArrowRightLinear" size={16} color={colors.accent} />
          </Pressable>
        ) : null}

        {!verified ? (
          <Pressable style={styles.verifyBanner} onPress={() => router.push(routes.validation)}>
            <Icon name="solarCarLinear" size={18} color={colors.chart3} />
            <Text style={styles.verifyText}>Rooms open once your ride is verified. Tap to check your trip.</Text>
          </Pressable>
        ) : null}

        {error ? <ErrorBanner message={error} style={styles.banner} /> : null}

        <FriendsStrip enabled={isAuthenticated} canJoin={verified && !busy} />

        {grid.isError ? <Text style={styles.gridNote}>Couldn't load live rooms. Retrying…</Text> : null}
        {!grid.isLoading && !grid.isError && rooms.length === 0 ? (
          <Text style={styles.gridNote}>No open rooms right now — host one and riders will join you.</Text>
        ) : null}
        <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {cardW > 0
            ? Array.from({ length: GRID_SLOTS }, (_, i) => {
                const room = rooms[i];
                return room ? (
                  <RoomCard
                    key={room.roomId}
                    room={room}
                    size={size}
                    joining={joiningId === room.roomId}
                    disabled={!verified || busy}
                    onPress={() => void join(room)}
                  />
                ) : (
                  <OpenSlot key={`slot-${i}`} size={size} disabled={!verified || busy} onPress={() => setHostOpen(true)} />
                );
              })
            : null}
        </View>
      </Screen>

      <View style={[styles.dockWrap, { bottom: TAB_BAR_HEIGHT + insets.bottom + 8 }]} pointerEvents="box-none">
        <BlurView intensity={40} tint="light" style={styles.dock}>
          <Pressable
            onPress={() => setHostOpen(true)}
            disabled={!verified || busy}
            style={({ pressed }) => [styles.dockButton, styles.hostButton, (!verified || busy) && styles.dockDisabled, pressed && styles.cardPressed]}
            accessibilityRole="button"
            accessibilityHint="Start your own Rolling Room and steer the conversation"
          >
            {hostRoom.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <>
                <Text style={styles.hostTitle}>Host a Room</Text>
                <Text style={styles.hostCopy}>Start your own Rolling Room and steer the conversation.</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push(routes.vibeSelection)}
            disabled={!verified || busy}
            style={({ pressed }) => [styles.dockButton, styles.joinButton, (!verified || busy) && styles.dockDisabled, pressed && styles.cardPressed]}
            accessibilityRole="button"
            accessibilityHint="Jump into a live Rolling Room that matches your mood"
          >
            <Text style={styles.joinTitle}>Join a Room</Text>
            <Text style={styles.joinCopy}>Jump into a live Rolling Room and connect with others.</Text>
          </Pressable>
        </BlurView>
      </View>

      <SafetyFab style={{ bottom: TAB_BAR_HEIGHT + DOCK_CLEARANCE + insets.bottom + 4 }} />
      <OptionSheet
        visible={hostOpen}
        title="Pick your room's mood"
        options={HOST_OPTIONS}
        onSelect={(vibe) => void host(vibe)}
        onClose={() => setHostOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { ...textSize.xl, fontFamily: fonts.heading.bold, color: colors.foreground, letterSpacing: tracking.tight(20) },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  subtitle: { ...textSize.xs, fontFamily: fonts.sans.medium, color: colors.mutedForeground },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.accent, 0.1),
  },
  notVerified: { backgroundColor: withAlpha(colors.chart3, 0.1) },
  verifiedText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.accent },
  returnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.3),
    backgroundColor: withAlpha(colors.accent, 0.08),
  },
  returnText: { flex: 1, ...textSize.xs, fontFamily: fonts.sans.semibold, color: colors.foreground },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: withAlpha(colors.chart3, 0.3),
    backgroundColor: withAlpha(colors.chart3, 0.08),
  },
  verifyText: { flex: 1, ...textSize.xs, fontFamily: fonts.sans.medium, color: colors.foreground },
  banner: { marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  gridNote: { ...textSize.xs, fontFamily: fonts.sans.medium, color: colors.mutedForeground, textAlign: 'center', marginBottom: 12 },
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.foreground,
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.25),
    ...shadow.sm,
  },
  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  moodTag: { position: 'absolute', top: 6, left: 6, right: 6, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  moodTagText: { ...textSize['10'], fontFamily: fonts.sans.bold, color: colors.white },
  cardCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: withAlpha(colors.white, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { ...textSize.base, fontFamily: fonts.heading.bold, color: colors.white },
  cardFooter: { paddingHorizontal: 8, paddingBottom: 8, gap: 2 },
  hostName: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.white },
  occupancy: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  occupancyText: { ...textSize['10'], fontFamily: fonts.mono.bold, color: colors.white },
  seatsText: { ...textSize['10'], fontFamily: fonts.sans.medium, color: withAlpha(colors.white, 0.75), flexShrink: 1 },
  joining: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.black, 0.45) },
  slot: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: withAlpha(colors.secondary, 0.7),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  slotText: { ...textSize['10'], fontFamily: fonts.sans.semibold, color: colors.mutedForeground },
  dockWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  dock: {
    width: '100%',
    maxWidth: 448,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.7),
    backgroundColor: withAlpha(colors.card, 0.6),
    ...shadow.lg,
  },
  dockButton: { flex: 1, minHeight: 92, borderRadius: radius.xl, padding: 12, justifyContent: 'center', gap: 4 },
  dockDisabled: { opacity: 0.45 },
  hostButton: { backgroundColor: colors.primary, ...tintedShadow(colors.primary, 0.35, 'md') },
  hostTitle: { ...textSize.sm, fontFamily: fonts.heading.bold, color: colors.primaryForeground },
  hostCopy: { ...textSize['11'], fontFamily: fonts.sans.medium, color: withAlpha(colors.primaryForeground, 0.85) },
  joinButton: { backgroundColor: withAlpha(colors.card, 0.9), borderWidth: 1, borderColor: colors.border },
  joinTitle: { ...textSize.sm, fontFamily: fonts.heading.bold, color: colors.foreground },
  joinCopy: { ...textSize['11'], fontFamily: fonts.sans.medium, color: colors.mutedForeground },
});
