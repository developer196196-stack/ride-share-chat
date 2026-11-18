/**
 * Countdown bar under the room header when the room's transit mode has a time limit (Max room,
 * set in the admin panel). Shows the time left and a bar that empties as the room nears closing;
 * it turns red in the last 2 minutes. Hidden when the room has no limit.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, withAlpha } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Icon } from '@/components/ui';
import { formatCountdown } from '@/hooks/use-grace-countdown';

/** Matches the server's "closes in 2 minutes" notice. */
const ENDING_SOON_SEC = 120;

export function RoomTimer({ openedAt, closesAt }: { openedAt?: string; closesAt?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!closesAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [closesAt]);

  if (!closesAt) return null;
  const end = Date.parse(closesAt);
  const start = openedAt ? Date.parse(openedAt) : NaN;
  if (!Number.isFinite(end)) return null;

  const leftSec = Math.max(0, Math.ceil((end - now) / 1000));
  const total = Number.isFinite(start) && end > start ? end - start : null;
  const share = total ? Math.min(1, Math.max(0, (end - now) / total)) : 1;
  const endingSoon = leftSec <= ENDING_SOON_SEC;
  const tone = endingSoon ? colors.primary : colors.mutedForeground;
  const label = leftSec > 0 ? `Room closes in ${formatCountdown(leftSec)}` : 'Room closing…';

  return (
    <View
      style={[styles.wrap, endingSoon && styles.wrapSoon]}
      accessibilityRole="timer"
      accessibilityLabel={leftSec > 0 ? `This room closes in ${Math.ceil(leftSec / 60)} minutes` : 'This room is closing'}
    >
      <View style={styles.row}>
        <Icon name="solarHourglassLineBold" size={13} color={tone} />
        <Text style={[styles.text, { color: tone }]}>{label}</Text>
        {total ? <Text style={styles.limit}>{Math.round(total / 60_000)} min room</Text> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: endingSoon ? colors.primary : colors.foreground }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  wrapSoon: { borderColor: withAlpha(colors.primary, 0.35), backgroundColor: withAlpha(colors.primary, 0.05) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { ...textSize.xs, fontFamily: fonts.mono.bold, flex: 1 },
  limit: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  track: { height: 4, borderRadius: radius.full, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
});
