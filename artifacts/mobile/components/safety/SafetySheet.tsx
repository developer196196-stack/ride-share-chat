import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import {
  useCreateSafetyAlert,
  useGetAuthMe,
  getGetAuthMeQueryKey,
  type SafetyAlertResult,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import type { IconName } from '@/constants/icons';
import { MAX_CONTENT_WIDTH, radius } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { fonts, textSize } from '@/constants/typography';
import { ErrorBanner, Icon } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/api/error-message';
import {
  callEmergency,
  composeEmail,
  composeSms,
  emergencyNumberFor,
  sendToContact,
  shareAnyApp,
} from '@/lib/safety/compose';
import { useAuthStore } from '@/stores/auth.store';

type Props = { visible: boolean; onClose: () => void };

type Kind = 'share_status' | 'emergency';

async function currentLocation() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getLastKnownPositionAsync();
    return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * Safety shield sheet: share live trip status, alert trusted contacts, or call the local
 * emergency number. Messages open in the rider's own apps, pre-filled.
 */
export function SafetySheet({ visible, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const me = useGetAuthMe({ query: { queryKey: getGetAuthMeQueryKey(), enabled: isAuthenticated && visible } });
  const createAlert = useCreateSafetyAlert();
  const [result, setResult] = useState<(SafetyAlertResult & { kind: Kind }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  const start = async (kind: Kind) => {
    setError(null);
    try {
      const alert = await createAlert.mutateAsync({ data: { kind, location: await currentLocation() } });
      setResult({ ...alert, kind });
      // Emergency: open SMS to every SMS contact straight away (fastest path).
      if (kind === 'emergency') {
        const phones = alert.contacts.filter((c) => c.channel === 'sms' && c.phone).map((c) => c.phone!);
        if (phones.length > 0) await composeSms(phones, alert.message);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not prepare the alert.'));
    }
  };

  const subject = result?.kind === 'emergency' ? 'Safety alert — Rideshare Chats' : 'My live trip status';
  const emergencyNumber = emergencyNumberFor(me.data?.countryCode);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close safety options" />
      <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Icon name="solarShieldCheckBold" size={20} color={colors.primary} />
          <Text style={styles.title}>Safety</Text>
        </View>

        {!isAuthenticated ? (
          <Text style={styles.hint}>Sign in to share your trip status with trusted contacts.</Text>
        ) : result ? (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            <Text style={styles.hint}>
              {result.kind === 'emergency' ? 'Alert ready.' : 'Trip link ready.'} Tap a contact to open your messaging app
              with the message filled in, then press Send.
            </Text>
            <View style={styles.linkBox}>
              <Text style={styles.linkText} numberOfLines={2}>
                {result.shareUrl}
              </Text>
            </View>
            {result.contacts.map((contact) => (
              <Pressable
                key={contact.id}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => void sendToContact(contact, result.message, subject)}
              >
                <Icon name="solarPlainBold" size={18} color={colors.primary} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{contact.name}</Text>
                  <Text style={styles.rowCaption}>
                    {contact.channel.toUpperCase()} · {contact.phone ?? contact.email}
                  </Text>
                </View>
                <Icon name="solarAltArrowRightLinear" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
            {result.contacts.some((c) => c.channel === 'email') ? (
              <Action
                icon="solarPlainBold"
                title="Email all email contacts"
                onPress={() =>
                  void composeEmail(
                    result.contacts.filter((c) => c.channel === 'email' && c.email).map((c) => c.email!),
                    subject,
                    result.message,
                  )
                }
              />
            ) : null}
            <Action icon="solarLinkCircleBold" title="Share with another app" onPress={() => void shareAnyApp(result.message)} />
            {result.contacts.length === 0 ? (
              <Action
                icon="solarUsersGroupRoundedBold"
                title="Add trusted contacts"
                caption="Pre-select who gets your alerts"
                onPress={() => {
                  close();
                  router.push(routes.safetyContacts);
                }}
              />
            ) : null}
          </ScrollView>
        ) : (
          <View style={styles.listContent}>
            <Action
              icon="solarMapPointBold"
              title="Share live trip status"
              caption="Send a live tracking link to family or friends"
              onPress={() => void start('share_status')}
              busy={createAlert.isPending}
            />
            <Action
              icon="solarShieldWarningBold"
              title="Alert emergency contacts"
              caption="Pre-filled alert with your live location link"
              tone="danger"
              onPress={() => void start('emergency')}
              busy={createAlert.isPending}
            />
            <Action
              icon="solarPhoneCallingRoundedBold"
              title={`Call emergency services (${emergencyNumber})`}
              caption="Opens your phone dialer"
              tone="danger"
              onPress={() => void callEmergency(me.data?.countryCode)}
            />
          </View>
        )}

        {error ? <ErrorBanner message={error} style={styles.error} /> : null}

        <Pressable style={styles.closeButton} onPress={close}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Action({
  icon,
  title,
  caption,
  onPress,
  tone = 'default',
  busy = false,
}: {
  icon: IconName;
  title: string;
  caption?: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  busy?: boolean;
}) {
  const tint = tone === 'danger' ? colors.destructive : colors.primary;
  return (
    <Pressable
      style={({ pressed }) => [styles.action, pressed && styles.rowPressed]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
    >
      <View style={[styles.actionIcon, { backgroundColor: withAlpha(tint, 0.1) }]}>
        {busy ? <ActivityIndicator size="small" color={tint} /> : <Icon name={icon} size={20} color={tint} />}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, tone === 'danger' && { color: colors.destructive }]}>{title}</Text>
        {caption ? <Text style={styles.rowCaption}>{caption}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: withAlpha(colors.black, 0.45) },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.full, backgroundColor: colors.muted, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  title: { ...textSize.lg, fontFamily: fonts.heading.bold, color: colors.foreground },
  hint: { ...textSize.xs, fontFamily: fonts.sans.regular, color: colors.mutedForeground, paddingHorizontal: 4, marginBottom: 8 },
  list: { flexGrow: 0 },
  listContent: { gap: 8, paddingBottom: 8 },
  linkBox: { padding: 10, borderRadius: radius.lg, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  linkText: { ...textSize['11'], fontFamily: fonts.mono.medium, color: colors.foreground },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.secondary },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...textSize.sm, fontFamily: fonts.sans.bold, color: colors.foreground },
  rowCaption: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  actionIcon: { width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: 8 },
  closeButton: { marginTop: 12, height: 44, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  closeText: { ...textSize.sm, fontFamily: fonts.sans.bold, color: colors.foreground },
});
