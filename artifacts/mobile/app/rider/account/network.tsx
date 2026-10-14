/** Friends & Followers: who you follow, who follows you, and which friends are riding now. */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getListFollowersQueryKey,
  getListFollowingQueryKey,
  useListFollowers,
  useListFollowing,
  type SocialUser,
} from '@workspace/api-client-react';
import { colors } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Card, ErrorBanner, Screen } from '@/components/ui';
import { AccountHeader } from '@/components/rideshare/AccountHeader';
import { SignInRequired } from '@/components/rideshare/SignInRequired';
import { FollowButton } from '@/components/social/FollowButton';
import { UserRow } from '@/components/social/UserRow';
import { useAuthStore } from '@/stores/auth.store';

type Tab = 'following' | 'followers';

function caption(u: SocialUser): string {
  if (u.isFollowing && u.followsYou) return `Friends${u.homeCity ? ` · ${u.homeCity}` : ''}`;
  return u.homeCity ?? (u.followsYou ? 'Follows you' : 'Rider');
}

export default function NetworkScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const [tab, setTab] = useState<Tab>('following');
  const following = useListFollowing({ query: { queryKey: getListFollowingQueryKey(), enabled: isAuthenticated, refetchInterval: 15_000 } });
  const followers = useListFollowers({ query: { queryKey: getListFollowersQueryKey(), enabled: isAuthenticated } });
  const active = tab === 'following' ? following : followers;
  const users = active.data?.users ?? [];

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.main}>
        <AccountHeader title="Friends & Followers" subtitle="Friends (you follow each other) can see when you're riding" />

        {isAuthReady && !isAuthenticated ? <SignInRequired message="Sign in to follow riders and see friends riding now." /> : null}

        <View style={styles.segment} accessibilityRole="tablist">
          {(['following', 'followers'] as const).map((key) => {
            const selected = tab === key;
            const count = (key === 'following' ? following : followers).data?.users.length;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[styles.segmentItem, selected && styles.segmentActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                  {key === 'following' ? 'Following' : 'Followers'}
                  {count != null ? ` · ${count}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {active.isError ? <ErrorBanner message="Couldn't load this list. It will retry shortly." /> : null}
        {active.isLoading && isAuthenticated ? <ActivityIndicator color={colors.primary} /> : null}

        {!active.isLoading && users.length === 0 && isAuthenticated ? (
          <Text style={styles.empty}>
            {tab === 'following'
              ? 'You aren’t following anyone yet. In a R.O.O.M., tap a rider’s video to open it full screen and follow them.'
              : 'No followers yet. Riders can follow you from inside a R.O.O.M.'}
          </Text>
        ) : null}

        {users.length > 0 ? (
          <Card style={styles.list}>
            {users.map((u) => (
              <UserRow
                key={u.uid}
                name={u.displayName}
                photoUrl={u.photoUrl}
                caption={caption(u)}
                live={u.live}
                right={<FollowButton uid={u.uid} following={u.isFollowing} followsYou={u.followsYou} />}
              />
            ))}
          </Card>
        ) : null}

        <Text style={styles.footnote}>
          Following is one-way. Your live room is only visible to friends — riders you follow back — never to one-way followers.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  main: { gap: 16 },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.full },
  segmentActive: { backgroundColor: colors.card, ...shadow.sm },
  segmentText: { ...textSize.sm, fontFamily: fonts.sans.semibold, color: colors.mutedForeground },
  segmentTextActive: { color: colors.foreground, fontFamily: fonts.sans.bold },
  list: { paddingHorizontal: 14, paddingVertical: 4 },
  empty: { ...textSize.sm, fontFamily: fonts.sans.regular, color: colors.mutedForeground, textAlign: 'center', paddingVertical: 16 },
  footnote: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground, textAlign: 'center' },
});
