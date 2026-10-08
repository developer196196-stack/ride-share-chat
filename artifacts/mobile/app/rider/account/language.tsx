/** New screen — Language & Translation preferences (native language, auto-translate, subtitles). */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetPreferencesQueryKey,
  useGetPreferences,
  useUpdatePreferences,
  type Preferences,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { LANGUAGES, languageLabel } from '@/constants/languages';
import { radius } from '@/constants/layout';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Card, ErrorBanner, Icon, OptionSheet, Screen, Toggle } from '@/components/ui';
import { AccountHeader } from '@/components/rideshare/AccountHeader';
import { SignInRequired } from '@/components/rideshare/SignInRequired';
import { useAuthStore } from '@/stores/auth.store';
import { getApiErrorMessage } from '@/lib/api/error-message';

const SIZES: { value: Preferences['subtitleSize']; label: string; px: number }[] = [
  { value: 'sm', label: 'Small', px: 11 },
  { value: 'md', label: 'Medium', px: 13 },
  { value: 'lg', label: 'Large', px: 16 },
];

const STYLES: { value: Preferences['subtitleStyle']; label: string; caption: string }[] = [
  { value: 'bubble', label: 'Chat bubbles', caption: 'Messages in rounded bubbles' },
  { value: 'subtitle', label: 'Live subtitles', caption: 'Plain caption lines over the video' },
];

export default function LanguageSettingsScreen() {
  const queryClient = useQueryClient();
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const prefs = useGetPreferences({ query: { queryKey: getGetPreferencesQueryKey(), enabled: isAuthenticated } });
  const update = useUpdatePreferences();
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (prefs.data && !draft) setDraft(prefs.data);
  }, [prefs.data, draft]);

  const options = useMemo(
    () => LANGUAGES.map((l) => ({ value: l.code, label: l.label, trailing: l.native })),
    [],
  );

  const change = (patch: Partial<Preferences>) => {
    setSaved(false);
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const save = async () => {
    if (!draft) return;
    setError(null);
    try {
      const result = await update.mutateAsync({ data: draft });
      queryClient.setQueryData(getGetPreferencesQueryKey(), result);
      setDraft(result);
      setSaved(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save your preferences.'));
    }
  };

  const size = SIZES.find((s) => s.value === draft?.subtitleSize) ?? SIZES[1]!;

  return (
    <Screen spaceBetween contentStyle={styles.content}>
      <View style={styles.main}>
        <AccountHeader title="Language & Translation" subtitle="How chat is shown to you in R.O.O.M.s" />

        {isAuthReady && !isAuthenticated ? (
          <SignInRequired message="Sign in to choose your language and translation settings." />
        ) : !draft ? (
          prefs.error ? (
            <ErrorBanner message={getApiErrorMessage(prefs.error, 'Could not load preferences.')} />
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          )
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Native Language</Text>
              <Pressable onPress={() => setPickerOpen(true)}>
                <Card style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{languageLabel(draft.nativeLanguage)}</Text>
                    <Text style={styles.rowCaption}>Incoming messages are translated into this language</Text>
                  </View>
                  <Icon name="solarAltArrowDownLinear" size={16} color={colors.mutedForeground} />
                </Card>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Translation</Text>
              <Card style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Auto-translate chat</Text>
                  <Text style={styles.rowCaption}>Turn off to always see messages in their original language</Text>
                </View>
                <Toggle value={draft.autoTranslate} onValueChange={(v) => change({ autoTranslate: v })} accessibilityLabel="Auto-translate chat" />
              </Card>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subtitle Size</Text>
              <View style={styles.segment}>
                {SIZES.map((s) => (
                  <Pressable
                    key={s.value}
                    onPress={() => change({ subtitleSize: s.value })}
                    style={[styles.segmentItem, draft.subtitleSize === s.value && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, draft.subtitleSize === s.value && { color: colors.primary }]}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Display Style</Text>
              {STYLES.map((st) => (
                <Pressable key={st.value} onPress={() => change({ subtitleStyle: st.value })}>
                  <Card style={[styles.row, draft.subtitleStyle === st.value && styles.rowActive]}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>{st.label}</Text>
                      <Text style={styles.rowCaption}>{st.caption}</Text>
                    </View>
                    {draft.subtitleStyle === st.value ? <Icon name="solarCheckCircleBold" size={18} color={colors.primary} /> : null}
                  </Card>
                </Pressable>
              ))}
            </View>

            <View style={styles.preview}>
              <Text style={styles.previewLabel}>Preview</Text>
              <View style={draft.subtitleStyle === 'bubble' ? styles.previewBubble : undefined}>
                <Text
                  style={[
                    styles.previewText,
                    { fontSize: size.px, lineHeight: Math.round(size.px * 1.35) },
                    draft.subtitleStyle === 'subtitle' && { color: colors.white },
                  ]}
                >
                  <Text style={styles.previewAuthor}>Maya: </Text>
                  Heading to the airport right now ✈️
                </Text>
                {draft.autoTranslate ? <Text style={styles.previewTag}>Translated from Spanish · tap for original</Text> : null}
              </View>
            </View>
          </>
        )}

        {error ? <ErrorBanner message={error} /> : null}
      </View>

      <View style={styles.footer}>
        <Button
          label={saved ? 'Saved' : 'Save Preferences'}
          icon={saved ? 'solarCheckCircleBold' : undefined}
          height={48}
          borderRadius={radius.xl}
          size="sm"
          loading={update.isPending}
          disabled={!draft}
          onPress={save}
        />
      </View>

      <OptionSheet
        visible={pickerOpen}
        title="Native language"
        options={options}
        selected={draft?.nativeLanguage}
        onSelect={(code) => change({ nativeLanguage: code })}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  main: { gap: 20 },
  loading: { marginTop: 40 },
  section: { gap: 8 },
  sectionTitle: {
    ...textSize.xs,
    fontFamily: fonts.heading.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(12),
  },
  row: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowActive: { borderColor: colors.primary },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...textSize.sm, fontFamily: fonts.sans.bold, color: colors.foreground },
  rowCaption: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  segment: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.xl, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.lg },
  segmentActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: withAlpha(colors.primary, 0.3) },
  segmentText: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.foreground },
  preview: { padding: 14, borderRadius: radius['2xl'], backgroundColor: colors.foreground, gap: 8 },
  previewLabel: { ...textSize['10'], fontFamily: fonts.mono.bold, color: withAlpha(colors.white, 0.6), textTransform: 'uppercase' },
  previewBubble: { alignSelf: 'flex-start', padding: 8, borderRadius: radius.lg, backgroundColor: withAlpha(colors.white, 0.92) },
  previewText: { fontFamily: fonts.sans.regular, color: colors.foreground },
  previewAuthor: { fontFamily: fonts.sans.bold, color: colors.accent },
  previewTag: { ...textSize['9'], fontFamily: fonts.sans.medium, color: colors.mutedForeground, marginTop: 2 },
  footer: { paddingTop: 16 },
});
