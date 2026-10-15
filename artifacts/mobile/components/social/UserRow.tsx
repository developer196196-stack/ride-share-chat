import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { LiveRoom } from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { vibeOption } from '@/constants/vibes';
import { fonts, textSize } from '@/constants/typography';
import { LiveDot } from '@/components/ui';

export function Avatar({ name, photoUrl, size = 40, ring }: { name: string; photoUrl: string | null; size?: number; ring?: string }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size },
        ring ? { borderWidth: 2, borderColor: ring } : null,
      ]}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{name.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}

/** "Riding now · #PartyMode (host)" for a friend's live room. */
export function liveLabel(live: LiveRoom): string {
  const mood = `#${vibeOption(live.vibe).label.replace(/\s+/g, '')}`;
  return `Riding now · ${mood}${live.isHost ? ' · hosting' : ''}`;
}

type Props = {
  name: string;
  photoUrl: string | null;
  caption: string;
  live?: LiveRoom | null;
  right?: React.ReactNode;
};

/** Avatar, name, caption (or friend's live room) and a trailing action. */
export function UserRow({ name, photoUrl, caption, live, right }: Props) {
  const ring = live ? vibeOption(live.vibe).color : undefined;
  return (
    <View style={styles.row}>
      <Avatar name={name} photoUrl={photoUrl} ring={ring} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {live ? (
          <View style={styles.liveRow}>
            <LiveDot size={6} color={colors.accent} />
            <Text style={[styles.caption, { color: colors.accent }]} numberOfLines={1}>
              {liveLabel(live)}
            </Text>
          </View>
        ) : (
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: withAlpha(colors.primary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.heading.bold, color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  text: { flex: 1 },
  name: { ...textSize.sm, fontFamily: fonts.sans.semibold, color: colors.foreground },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caption: { ...textSize.xs, fontFamily: fonts.sans.regular, color: colors.mutedForeground },
});
