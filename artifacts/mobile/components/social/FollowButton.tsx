import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  followUser,
  getGetUserProfileQueryKey,
  getListFollowersQueryKey,
  getListFollowingQueryKey,
  unfollowUser,
} from '@workspace/api-client-react';
import { colors } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useTripStore } from '@/stores/trip.store';

type Props = {
  uid: string;
  following: boolean;
  /** They follow you: offer "Follow back". */
  followsYou?: boolean;
  /** Dark video background (room focus view). */
  onDark?: boolean;
};

/** Follow / Following toggle; refreshes profile and follow lists. */
export function FollowButton({ uid, following, followsYou = false, onDark = false }: Props) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  // Optimistic until the lists refetch.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const isFollowing = optimistic ?? following;

  const toggle = async () => {
    setBusy(true);
    setOptimistic(!isFollowing);
    try {
      if (isFollowing) await unfollowUser(uid);
      else await followUser(uid);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(uid) }),
        queryClient.invalidateQueries({ queryKey: getListFollowingQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListFollowersQueryKey() }),
      ]);
    } catch (err) {
      setOptimistic(null);
      useTripStore.getState().setNotice({ message: getApiErrorMessage(err, 'Could not update follow.'), tone: 'warning' });
    } finally {
      setBusy(false);
      setOptimistic(null);
    }
  };

  let label = 'Follow';
  if (isFollowing) label = 'Following';
  else if (followsYou) label = 'Follow back';

  return (
    <Pressable
      onPress={() => void toggle()}
      disabled={busy}
      style={({ pressed }) => [
        styles.button,
        isFollowing ? (onDark ? styles.followingDark : styles.following) : styles.follow,
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isFollowing }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={isFollowing && !onDark ? colors.foreground : colors.white} />
      ) : (
        <Text style={[styles.text, isFollowing && !onDark ? styles.textFollowing : null]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minWidth: 92, height: 32, paddingHorizontal: 12, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  follow: { backgroundColor: colors.primary },
  following: { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  followingDark: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  text: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.white },
  textFollowing: { color: colors.foreground },
});
