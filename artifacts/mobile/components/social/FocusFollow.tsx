import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getGetUserProfileQueryKey, useGetUserProfile } from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { FollowButton } from './FollowButton';

/** On a rider's full-screen video: follower count and Follow / Following. */
export function FocusFollow({ uid }: { uid: string }) {
  const profile = useGetUserProfile(uid, { query: { queryKey: getGetUserProfileQueryKey(uid), staleTime: 30_000 } });
  if (!profile.data) return null;
  const p = profile.data;
  return (
    <View style={styles.bar}>
      <Text style={styles.text} numberOfLines={1}>
        {p.followerCount} follower{p.followerCount === 1 ? '' : 's'}
        {p.followsYou ? ' · follows you' : ''}
      </Text>
      <FollowButton uid={uid} following={p.isFollowing} followsYou={p.followsYou} onDark />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.black, 0.55),
  },
  text: { ...textSize.xs, fontFamily: fonts.sans.semibold, color: colors.white, flexShrink: 1 },
});
