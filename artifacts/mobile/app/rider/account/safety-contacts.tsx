/** New screen — Safety & Trusted Contacts hub (contacts for alerts + share-on-verified prompt). */
import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Contact } from 'expo-contacts';
import {
  getGetAuthMeQueryKey,
  getGetPreferencesQueryKey,
  getListTrustedContactsQueryKey,
  useCreateTrustedContact,
  useDeleteTrustedContact,
  useGetAuthMe,
  useGetPreferences,
  useListTrustedContacts,
  useUpdatePreferences,
  type ContactChannel,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { COUNTRIES, DEFAULT_COUNTRY } from '@/constants/countries';
import { radius, webInputReset } from '@/constants/layout';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Card, ErrorBanner, Icon, Screen, Toggle } from '@/components/ui';
import { AccountHeader } from '@/components/rideshare/AccountHeader';
import { SignInRequired } from '@/components/rideshare/SignInRequired';
import { useAuthStore } from '@/stores/auth.store';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { emergencyNumberFor } from '@/lib/safety/compose';

const MAX_CONTACTS = 5;
const CHANNELS: { value: ContactChannel; label: string }[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];

/** Normalises a typed or picked number to E.164 using the rider's dial code when needed. */
function toE164(raw: string, dialCode: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) return `+${trimmed.replace(/\D/g, '')}`;
  const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `${dialCode}${digits}` : '';
}

export default function SafetyContactsScreen() {
  const queryClient = useQueryClient();
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const me = useGetAuthMe({ query: { queryKey: getGetAuthMeQueryKey(), enabled: isAuthenticated } });
  const contacts = useListTrustedContacts({ query: { queryKey: getListTrustedContactsQueryKey(), enabled: isAuthenticated } });
  const prefs = useGetPreferences({ query: { queryKey: getGetPreferencesQueryKey(), enabled: isAuthenticated } });
  const create = useCreateTrustedContact();
  const remove = useDeleteTrustedContact();
  const updatePrefs = useUpdatePreferences();

  const [name, setName] = useState('');
  const [channel, setChannel] = useState<ContactChannel>('sms');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dialCode = COUNTRIES.find((c) => c.iso === me.data?.countryCode)?.dialCode ?? DEFAULT_COUNTRY.dialCode;
  const list = contacts.data ?? [];
  const full = list.length >= MAX_CONTACTS;

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListTrustedContactsQueryKey() });

  const pickFromPhone = async () => {
    setError(null);
    try {
      const picked = await Contact.presentPicker();
      if (!picked) return;
      const [fullName, phones, emails] = await Promise.all([
        picked.getFullName().catch(() => ''),
        picked.getPhones().catch(() => []),
        picked.getEmails().catch(() => []),
      ]);
      if (fullName) setName(fullName);
      const number = phones.find((p) => p.number)?.number;
      const address = emails.find((e) => e.address)?.address;
      if (number) setPhone(number);
      if (address) setEmail(address);
      if (!number && address) setChannel('email');
    } catch {
      setError('Could not open your contacts. You can type the details instead.');
    }
  };

  const add = async () => {
    setError(null);
    const e164 = channel === 'email' ? null : toE164(phone, dialCode);
    try {
      await create.mutateAsync({
        data: {
          name: name.trim(),
          channel,
          phone: e164 || null,
          email: channel === 'email' ? email.trim() || null : null,
        },
      });
      setName('');
      setPhone('');
      setEmail('');
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add the contact.'));
    }
  };

  const togglePrompt = async (value: boolean) => {
    if (!prefs.data) return;
    try {
      const result = await updatePrefs.mutateAsync({ data: { ...prefs.data, promptShareOnVerified: value } });
      queryClient.setQueryData(getGetPreferencesQueryKey(), result);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const canAdd = name.trim().length > 0 && (channel === 'email' ? email.trim().length > 3 : phone.replace(/\D/g, '').length >= 6);

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.main}>
        <AccountHeader title="Safety & Trusted Contacts" subtitle="Who gets your live trip status and alerts" />

        {isAuthReady && !isAuthenticated ? (
          <SignInRequired message="Sign in to add trusted contacts for live trip sharing." />
        ) : null}

        <Card style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Offer to share when VERIFIED</Text>
            <Text style={styles.rowCaption}>A one-tap "Share my trip" appears each time a ride is verified</Text>
          </View>
          <Toggle
            value={prefs.data?.promptShareOnVerified ?? false}
            onValueChange={(v) => void togglePrompt(v)}
            accessibilityLabel="Offer to share trip when verified"
          />
        </Card>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trusted Contacts</Text>
            <Text style={styles.sectionMeta}>
              {list.length}/{MAX_CONTACTS}
            </Text>
          </View>
          {contacts.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {list.length === 0 && !contacts.isLoading ? (
            <Text style={styles.empty}>No trusted contacts yet. Add family or friends below.</Text>
          ) : null}
          {list.map((c) => (
            <Card key={c.id} style={styles.contact}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{c.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.rowCaption}>
                  {c.channel.toUpperCase()} · {c.phone ?? c.email}
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() => void remove.mutateAsync({ contactId: c.id }).then(refresh)}
                accessibilityLabel={`Remove ${c.name}`}
              >
                <Icon name="solarCloseCircleLinear" size={20} color={colors.mutedForeground} />
              </Pressable>
            </Card>
          ))}
        </View>

        {!full ? (
          <Card style={styles.form}>
            <View style={styles.formHeader}>
              <Text style={styles.rowTitle}>Add a contact</Text>
              {Platform.OS !== 'web' ? (
                <Pressable onPress={() => void pickFromPhone()} style={styles.pickButton}>
                  <Icon name="solarUsersGroupRoundedBold" size={14} color={colors.primary} />
                  <Text style={styles.pickText}>From contacts</Text>
                </Pressable>
              ) : null}
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={colors.mutedForeground}
              maxLength={60}
            />
            <View style={styles.segment}>
              {CHANNELS.map((ch) => (
                <Pressable
                  key={ch.value}
                  onPress={() => setChannel(ch.value)}
                  style={[styles.segmentItem, channel === ch.value && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, channel === ch.value && { color: colors.primary }]}>{ch.label}</Text>
                </Pressable>
              ))}
            </View>
            {channel === 'email' ? (
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : (
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder={`${dialCode} phone number`}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />
            )}
            <Button label="Add Contact" height={44} borderRadius={radius.xl} size="sm" disabled={!canAdd} loading={create.isPending} onPress={add} />
          </Card>
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}

        <Card style={styles.info}>
          <Icon name="solarShieldCheckBold" size={18} color={colors.accent} />
          <Text style={styles.infoText}>
            Alerts open your own SMS, WhatsApp or email app with the message and live trip link filled in — you tap Send.
            In an emergency, call {emergencyNumberFor(me.data?.countryCode)}.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  main: { gap: 20 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: {
    ...textSize.xs,
    fontFamily: fonts.heading.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(12),
  },
  sectionMeta: { ...textSize['11'], fontFamily: fonts.mono.bold, color: colors.mutedForeground },
  empty: { ...textSize.xs, fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  row: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...textSize.sm, fontFamily: fonts.sans.bold, color: colors.foreground },
  rowCaption: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  contact: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: withAlpha(colors.primary, 0.1), alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...textSize.sm, fontFamily: fonts.heading.bold, color: colors.primary },
  form: { padding: 14, gap: 10 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pickText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.primary },
  input: {
    ...webInputReset,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    ...textSize.sm,
    fontFamily: fonts.sans.semibold,
    color: colors.foreground,
  },
  segment: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.xl, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.lg },
  segmentActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: withAlpha(colors.primary, 0.3) },
  segmentText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.foreground },
  info: { padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { flex: 1, ...textSize.xs, fontFamily: fonts.sans.regular, color: colors.mutedForeground },
});
