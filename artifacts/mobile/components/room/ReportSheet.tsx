import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateReport, type ReportRequestReason, type RoomMember } from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { MAX_CONTENT_WIDTH, radius, webInputReset } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Button, ErrorBanner, Icon } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/api/error-message';

const REASONS: { value: ReportRequestReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'minor', label: 'Appears to be under 18' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'other', label: 'Something else' },
];

type Props = { visible: boolean; onClose: () => void; roomId: string | null; members: RoomMember[] };

export function ReportSheet({ visible, onClose, roomId, members }: Props) {
  const insets = useSafeAreaInsets();
  const report = useCreateReport();
  const [who, setWho] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportRequestReason | null>(null);
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setWho(null);
    setReason(null);
    setDetails('');
    setDone(false);
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!reason) return;
    setError(null);
    try {
      await report.mutateAsync({ data: { roomId, reportedUid: who, reason, details: details.trim() || null } });
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Report not sent.'));
    }
  };

  const others = members.filter((m) => !m.isSelf);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Icon name="solarShieldWarningBold" size={20} color={colors.primary} />
          <Text style={styles.title}>{done ? 'Report sent' : 'Report'}</Text>
        </View>
        {done ? (
          <>
            <Text style={styles.hint}>Thanks. Our moderators will review it with the recent chat from this R.O.O.M. You can also tap Next to leave right away.</Text>
            <Button label="Done" onPress={close} height={44} borderRadius={radius.xl} size="sm" />
          </>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <Text style={styles.label}>Who?</Text>
            <View style={styles.chips}>
              <Chip label="The whole room" active={who === null} onPress={() => setWho(null)} />
              {others.map((m) => (
                <Chip key={m.uid} label={m.displayName} active={who === m.uid} onPress={() => setWho(m.uid)} />
              ))}
            </View>
            <Text style={styles.label}>What happened?</Text>
            {REASONS.map((r) => (
              <Pressable key={r.value} style={[styles.reason, reason === r.value && styles.reasonActive]} onPress={() => setReason(r.value)}>
                <Text style={[styles.reasonText, reason === r.value && { color: colors.primary }]}>{r.label}</Text>
              </Pressable>
            ))}
            <TextInput
              style={styles.details}
              value={details}
              onChangeText={setDetails}
              placeholder="Add details (optional)"
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={1000}
            />
            {error ? <ErrorBanner message={error} /> : null}
            <Button
              label="Send report"
              onPress={submit}
              disabled={!reason}
              loading={report.isPending}
              height={44}
              borderRadius={radius.xl}
              size="sm"
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: withAlpha(colors.black, 0.45) },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    maxHeight: '85%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingTop: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.full, backgroundColor: colors.muted, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...textSize.lg, fontFamily: fonts.heading.bold, color: colors.foreground },
  hint: { ...textSize.sm, fontFamily: fonts.sans.regular, color: colors.mutedForeground, marginBottom: 8 },
  scroll: { flexGrow: 0 },
  content: { gap: 8, paddingBottom: 8 },
  label: { ...textSize.xs, fontFamily: fonts.sans.bold, color: colors.mutedForeground, textTransform: 'uppercase', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary },
  chipActive: { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, 0.08) },
  chipText: { ...textSize.xs, fontFamily: fonts.sans.semibold, color: colors.foreground },
  reason: { padding: 12, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  reasonActive: { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, 0.06) },
  reasonText: { ...textSize.sm, fontFamily: fonts.sans.semibold, color: colors.foreground },
  details: {
    ...webInputReset,
    minHeight: 72,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    textAlignVertical: 'top',
    ...textSize.sm,
    fontFamily: fonts.sans.regular,
    color: colors.foreground,
  },
});
