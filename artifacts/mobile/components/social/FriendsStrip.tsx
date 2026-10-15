import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getListFollowingQueryKey,
  joinRoomById,
  requestToJoinRoom,
  useListFollowing,
  type SocialUser,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { vibeOption } from '@/constants/vibes';
import { fonts, textSize } from '@/constants/typography';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useTripStore } from '@/stores/trip.store';
import { Avatar } from './UserRow';

/**
 * Friends (mutual follows) who are in a R.O.O.M. right now: join an open room directly, or ask a
 * friend who hosts a private room for a seat.
 */
export function FriendsStrip({ enabled, canJoin }: { enabled: boolean; canJoin: boolean }) {
  const router = useRouter();
  const following = useListFollowing({ query: { queryKey: getListFollowingQueryKey(), enabled, refetchInterval: 10_000 } });
  const currentRoomId = useTripStore((s) => s.room?.roomId);
  const [busy, setBusy] = useState<string | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const riding = (following.data?.users ?? []).filter((u) => u.live && u.live.roomId !== currentRoomId);
  if (!enabled || riding.length === 0) return null;

  const act = async (friend: SocialUser) => {
    const live = friend.live!;
    setBusy(friend.uid);
    try {
      if (live.open) {
        const session = await joinRoomById(live.roomId);
        useTripStore.getState().setRoom(session);
        router.push(routes.activeRoom);
      } else {
        await requestToJoinRoom(live.roomId);
        setRequested((prev) => new Set(prev).add(friend.uid));
        useTripStore.getState().setNotice({ message: `Asked ${friend.displayName.split(/\s+/)[0]} for a seat.` });
      }
    } catch (err) {
      useTripStore.getState().setNotice({ message: getApiErrorMessage(err, 'Could not reach that room.'), tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends riding now</Text>
        <Pressable onPress={() => router.push(routes.network)} hitSlop={8}>
          <Text style={styles.link}>All friends</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {riding.map((friend) => {
          const live = friend.live!;
          const mood = vibeOption(live.vibe);
          // A private room can only be asked through its host.
          const canAsk = !live.open && live.isHost;
          let label = 'Private';
          if (live.open) label = 'Join';
          else if (requested.has(friend.uid)) label = 'Asked';
          else if (canAsk) label = 'Ask to join';
          const disabled = !canJoin || busy != null || (!live.open && (!canAsk || requested.has(friend.uid)));
          return (
            <View key={friend.uid} style={styles.card}>
              <Avatar name={friend.displayName} photoUrl={friend.photoUrl} size={44} ring={mood.color} />
              <Text style={styles.name} numberOfLines={1}>
                {friend.displayName.split(/\s+/)[0]}
              </Text>
              <Text style={[styles.mood, { color: mood.color }]} numberOfLines={1}>
                #{mood.label.replace(/\s+/g, '')} · {live.memberCount}/{live.capacity}
              </Text>
              <Pressable
                onPress={() => void act(friend)}
                disabled={disabled}
                style={[styles.action, live.open ? styles.actionPrimary : styles.actionPlain, disabled && styles.actionDisabled]}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${friend.displayName}'s room`}
              >
                {busy === friend.uid ? (
                  <ActivityIndicator size="small" color={live.open ? colors.primaryForeground : colors.foreground} />
                ) : (
                  <Text style={[styles.actionText, !live.open && { color: colors.foreground }]}>{label}</Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...textSize.sm, fontFamily: fonts.heading.bold, color: colors.foreground },
  link: { ...textSize.xs, fontFamily: fonts.sans.semibold, color: colors.primary },
  row: { gap: 8 },
  card: {
    width: 112,
    alignItems: 'center',
    gap: 4,
    padding: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  name: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.foreground, marginTop: 2 },
  mood: { ...textSize['10'], fontFamily: fonts.sans.semibold },
  action: { marginTop: 4, alignSelf: 'stretch', height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: colors.primary },
  actionPlain: { backgroundColor: withAlpha(colors.secondary, 1), borderWidth: 1, borderColor: colors.border },
  actionDisabled: { opacity: 0.55 },
  actionText: { ...textSize['11'], fontFamily: fonts.sans.bold, color: colors.primaryForeground },
});
