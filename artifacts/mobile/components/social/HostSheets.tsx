import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  acceptJoinRequest,
  declineJoinRequest,
  getListFollowersQueryKey,
  getListFollowingQueryKey,
  getListJoinRequestsQueryKey,
  inviteToRoom,
  useListFollowers,
  useListFollowing,
  useListJoinRequests,
  type SocialUser,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { MAX_CONTENT_WIDTH, radius } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Icon } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { useTripStore } from '@/stores/trip.store';
import { UserRow } from './UserRow';

function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Icon name="solarCloseCircleLinear" size={24} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SmallButton({
  label,
  onPress,
  tone = 'primary',
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'plain';
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={[styles.button, tone === 'primary' ? styles.buttonPrimary : styles.buttonPlain, disabled && styles.buttonDisabled]}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator size="small" color={tone === 'primary' ? colors.primaryForeground : colors.foreground} />
      ) : (
        <Text style={[styles.buttonText, tone === 'plain' && { color: colors.foreground }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const relationCaption = (u: SocialUser) => {
  if (u.isFollowing && u.followsYou) return 'Friends';
  return u.isFollowing ? 'You follow them' : 'Follows you';
};

/** Host: invite people from your network (you follow them, or they follow you). */
export function InviteSheet({ visible, onClose, memberUids }: { visible: boolean; onClose: () => void; memberUids: string[] }) {
  const following = useListFollowing({ query: { queryKey: getListFollowingQueryKey(), enabled: visible } });
  const followers = useListFollowers({ query: { queryKey: getListFollowersQueryKey(), enabled: visible } });
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const network = useMemo(() => {
    const byUid = new Map<string, SocialUser>();
    for (const u of [...(following.data?.users ?? []), ...(followers.data?.users ?? [])]) byUid.set(u.uid, u);
    return [...byUid.values()].filter((u) => !memberUids.includes(u.uid));
  }, [following.data, followers.data, memberUids]);

  const invite = async (u: SocialUser) => {
    setBusy(u.uid);
    try {
      await inviteToRoom({ uid: u.uid });
      setInvited((prev) => new Set(prev).add(u.uid));
    } catch (err) {
      useTripStore.getState().setNotice({ message: getApiErrorMessage(err, 'Could not send the invite.'), tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  const loading = following.isLoading || followers.isLoading;
  return (
    <Sheet visible={visible} onClose={onClose} title="Invite to your room" subtitle="Invites last 10 minutes and get past Manual or Lock.">
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {!loading && network.length === 0 ? (
        <Text style={styles.empty}>Follow riders to invite them here. Tap someone's video full screen to follow them.</Text>
      ) : null}
      {network.map((u) => (
        <UserRow
          key={u.uid}
          name={u.displayName}
          photoUrl={u.photoUrl}
          caption={relationCaption(u)}
          live={u.live}
          right={
            <SmallButton
              label={invited.has(u.uid) ? 'Invited' : 'Invite'}
              tone={invited.has(u.uid) ? 'plain' : 'primary'}
              disabled={invited.has(u.uid)}
              busy={busy === u.uid}
              onPress={() => void invite(u)}
            />
          }
        />
      ))}
    </Sheet>
  );
}

/** Host: friends asking for a seat while the room is Manual or locked. */
export function RequestsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const requests = useListJoinRequests({ query: { queryKey: getListJoinRequestsQueryKey(), enabled: visible, refetchInterval: visible ? 5_000 : false } });
  const [busy, setBusy] = useState<string | null>(null);

  const respond = async (uid: string, accept: boolean) => {
    setBusy(uid);
    try {
      if (accept) await acceptJoinRequest(uid);
      else await declineJoinRequest(uid);
      await queryClient.invalidateQueries({ queryKey: getListJoinRequestsQueryKey() });
    } catch (err) {
      useTripStore.getState().setNotice({ message: getApiErrorMessage(err, 'Could not answer the request.'), tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  const list = requests.data?.requests ?? [];
  return (
    <Sheet visible={visible} onClose={onClose} title="Join requests" subtitle="Accepting sends them an invite to your room.">
      {requests.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
      {!requests.isLoading && list.length === 0 ? <Text style={styles.empty}>No one is waiting right now.</Text> : null}
      {list.map((r) => (
        <UserRow
          key={r.user.uid}
          name={r.user.displayName}
          photoUrl={r.user.photoUrl}
          caption={r.user.homeCity ?? 'Friend'}
          right={
            <View style={styles.actions}>
              <SmallButton label="Decline" tone="plain" busy={busy === r.user.uid} onPress={() => void respond(r.user.uid, false)} />
              <SmallButton label="Accept" busy={busy === r.user.uid} onPress={() => void respond(r.user.uid, true)} />
            </View>
          }
        />
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: withAlpha(colors.black, 0.4) },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    maxHeight: '75%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: radius.full, backgroundColor: colors.muted, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  headerText: { flex: 1 },
  title: { ...textSize.lg, fontFamily: fonts.heading.bold, color: colors.foreground },
  subtitle: { ...textSize.xs, fontFamily: fonts.sans.regular, color: colors.mutedForeground, marginTop: 2 },
  list: { flexGrow: 0 },
  listContent: { paddingBottom: 8 },
  loading: { marginVertical: 24 },
  empty: { ...textSize.sm, fontFamily: fonts.sans.regular, color: colors.mutedForeground, paddingVertical: 20, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 6 },
  button: { minWidth: 72, height: 32, paddingHorizontal: 12, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonPlain: { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.primaryForeground },
});
