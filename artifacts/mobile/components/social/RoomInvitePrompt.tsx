import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { joinRoomById } from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { MAX_CONTENT_WIDTH, radius, shadow } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { vibeOption } from '@/constants/vibes';
import { fonts, textSize } from '@/constants/typography';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useTripStore } from '@/stores/trip.store';
import { Avatar } from './UserRow';

/** "Alex invited you to #DeepTalks" — app-wide, until it's answered or expires. */
export function RoomInvitePrompt() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const invite = useTripStore((s) => s.invite);
  const [joining, setJoining] = useState(false);

  // Invites expire on the server after 10 minutes.
  useEffect(() => {
    if (!invite) return;
    const ms = new Date(invite.expiresAt).getTime() - Date.now();
    const timer = setTimeout(() => useTripStore.getState().setInvite(null), Math.max(0, ms));
    return () => clearTimeout(timer);
  }, [invite]);

  if (!invite) return null;
  const mood = vibeOption(invite.vibe);
  const first = invite.from.displayName.split(/\s+/)[0];

  const join = async () => {
    setJoining(true);
    try {
      const session = await joinRoomById(invite.roomId);
      const store = useTripStore.getState();
      store.setInvite(null);
      store.setRoom(session);
      router.push(routes.activeRoom);
    } catch (err) {
      useTripStore.getState().setInvite(null);
      useTripStore.getState().setNotice({ message: getApiErrorMessage(err, 'Could not join that room.'), tone: 'warning' });
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <View style={[styles.card, { borderColor: withAlpha(mood.color, 0.5) }]} accessibilityRole="alert">
        <Avatar name={invite.from.displayName} photoUrl={invite.from.photoUrl} size={44} ring={mood.color} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={2}>
            {invite.viaRequest ? `${first} let you in` : `${first} invited you`}
          </Text>
          <Text style={styles.caption} numberOfLines={1}>
            {`#${mood.label.replace(/\s+/g, '')} room · private`}
          </Text>
        </View>
        <Pressable
          style={styles.join}
          onPress={() => void join()}
          disabled={joining}
          accessibilityRole="button"
          accessibilityLabel={`Join ${first}'s room`}
        >
          {joining ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Text style={styles.joinText}>Join</Text>}
        </Pressable>
        <Pressable
          hitSlop={8}
          onPress={() => useTripStore.getState().setInvite(null)}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text style={styles.later}>Later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 40, elevation: 40 },
  card: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    backgroundColor: colors.card,
    ...shadow.lg,
  },
  text: { flex: 1 },
  title: { ...textSize.sm, fontFamily: fonts.sans.bold, color: colors.foreground },
  caption: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  join: { minWidth: 56, height: 32, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  joinText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.primaryForeground },
  later: { ...textSize.xs, fontFamily: fonts.sans.semibold, color: colors.mutedForeground },
});
