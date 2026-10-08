import React, { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ChatMessage, PreferencesSubtitleSize, PreferencesSubtitleStyle } from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius, webInputReset } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Icon } from '@/components/ui';
import { languageLabel } from '@/constants/languages';

type Props = {
  messages: ChatMessage[];
  selfUid: string | null;
  onSend: (text: string) => Promise<void>;
  subtitleSize?: PreferencesSubtitleSize;
  subtitleStyle?: PreferencesSubtitleStyle;
};

const QUICK_REACTIONS = ['🔥 vibe', '🚕 traffic', '👋 hello', '🎵 song'];
const FONT_SIZE = { sm: 11, md: 13, lg: 16 } as const;

/**
 * Semi-transparent, expandable chat panel over the video feed. Incoming messages arrive
 * already translated into the rider's language; tap a bubble to see the original.
 */
export function ChatOverlay({ messages, selfUid, onSend, subtitleSize = 'md', subtitleStyle = 'bubble' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const visible = expanded ? messages : messages.slice(-2);
  const fontSize = FONT_SIZE[subtitleSize];

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(trimmed);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message not sent');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.panel, expanded && styles.panelExpanded]}>
      <Pressable style={styles.handleRow} onPress={() => setExpanded((v) => !v)} accessibilityLabel={expanded ? 'Collapse chat' : 'Expand chat'}>
        <View style={styles.handle} />
        <Text style={styles.handleText}>{expanded ? 'Hide chat' : `Chat${messages.length ? ` · ${messages.length}` : ''}`}</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(m) => m.id}
        style={expanded ? styles.listExpanded : styles.listCollapsed}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>Say hi to your R.O.O.M. — messages are auto-translated.</Text>}
        renderItem={({ item }) => {
          const mine = item.senderId === selfUid;
          const original = showOriginal.has(item.id);
          const text = original ? item.original : item.text;
          return (
            <Pressable
              onPress={() =>
                item.translated &&
                setShowOriginal((prev) => {
                  const next = new Set(prev);
                  if (next.has(item.id)) next.delete(item.id);
                  else next.add(item.id);
                  return next;
                })
              }
              style={[
                subtitleStyle === 'bubble' ? styles.bubble : styles.subtitle,
                subtitleStyle === 'bubble' && mine && styles.bubbleMine,
              ]}
            >
              <Text style={[styles.line, { fontSize, lineHeight: Math.round(fontSize * 1.35) }]}>
                <Text style={[styles.author, { color: mine ? colors.primary : colors.accent }]}>
                  {mine ? 'You' : item.senderName}:{' '}
                </Text>
                {text}
              </Text>
              {item.translated ? (
                <Text style={styles.translatedTag}>
                  {original
                    ? 'Original · tap for translation'
                    : `Translated${item.originalLanguage ? ` from ${languageLabel(item.originalLanguage)}` : ''} · tap for original`}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      {expanded ? (
        <View style={styles.reactions}>
          {QUICK_REACTIONS.map((r) => (
            <Pressable key={r} style={styles.reaction} onPress={() => void send(r)}>
              <Text style={styles.reactionText}>{r}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onFocus={() => setExpanded(true)}
          placeholder="Drop a quick message…"
          placeholderTextColor={colors.mutedForeground}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => void send(draft)}
          editable={!sending}
          accessibilityLabel="Chat message"
        />
        <Pressable hitSlop={8} onPress={() => void send(draft)} disabled={sending || !draft.trim()} accessibilityLabel="Send message">
          <Icon name="solarPlainBold" size={18} color={draft.trim() ? colors.primary : colors.mutedForeground} />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.4),
    backgroundColor: withAlpha(colors.card, 0.86),
    padding: 8,
    gap: 6,
  },
  panelExpanded: { backgroundColor: withAlpha(colors.card, 0.94) },
  handleRow: { alignItems: 'center', gap: 2 },
  handle: { width: 32, height: 4, borderRadius: radius.full, backgroundColor: colors.muted },
  handleText: { ...textSize['10'], fontFamily: fonts.sans.semibold, color: colors.mutedForeground },
  listCollapsed: { maxHeight: 64 },
  listExpanded: { maxHeight: 220 },
  empty: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground, paddingVertical: 4 },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginVertical: 2,
    borderRadius: radius.lg,
    backgroundColor: withAlpha(colors.secondary, 0.9),
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: withAlpha(colors.primary, 0.08) },
  subtitle: { paddingVertical: 2 },
  line: { fontFamily: fonts.sans.regular, color: colors.foreground },
  author: { fontFamily: fonts.sans.bold },
  translatedTag: { ...textSize['9'], fontFamily: fonts.sans.medium, color: colors.mutedForeground, marginTop: 1 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reaction: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionText: { ...textSize.xs, fontFamily: fonts.sans.medium, color: colors.foreground },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: { ...webInputReset, flex: 1, ...textSize.xs, fontFamily: fonts.sans.regular, color: colors.foreground, padding: 0 },
  error: { ...textSize['10'], fontFamily: fonts.sans.semibold, color: colors.destructive },
});
