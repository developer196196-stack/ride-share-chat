import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, withAlpha } from '@/constants/colors';
import type { IconName } from '@/constants/icons';
import { radius } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { GlowBlob, Icon, Pulse, Spin } from '@/components/ui';

/** checking = sensors warming up · waiting = not moving yet · verified · stopped (grace / post-ride) · ended */
export type RingTone = 'checking' | 'waiting' | 'verified' | 'stopped' | 'ended';

const TONE: Record<RingTone, { color: string; icon: IconName }> = {
  checking: { color: colors.primary, icon: 'solarSatelliteLinear' },
  waiting: { color: colors.chart3, icon: 'solarCarLinear' },
  verified: { color: colors.accent, icon: 'solarVerifiedCheckBold' },
  stopped: { color: colors.chart3, icon: 'solarTrafficLinear' },
  ended: { color: colors.mutedForeground, icon: 'solarRefreshCircleBold' },
};

const SIZE = 208;
const STROKE = 6;
/** The glow spills past the ring without taking layout space. */
const GLOW = SIZE * 1.6;

type Props = {
  tone: RingTone;
  title: string;
  caption?: string;
};

/**
 * Frosted validation ring (client doc 5): spins while the engine checks the ride, pulses amber
 * while waiting for the ride to start, and glows green once verified.
 */
export function ValidationRing({ tone, title, caption }: Props) {
  const { color, icon } = TONE[tone];
  const track = <View style={[styles.track, { borderColor: withAlpha(color, 0.18) }]} />;
  const arc = <View style={[styles.arc, { borderTopColor: color, borderRightColor: withAlpha(color, 0.5) }]} />;
  const full = <View style={[styles.track, { borderColor: color }]} />;

  let ring: React.ReactNode;
  if (tone === 'checking') ring = <Spin style={styles.layer}>{arc}</Spin>;
  else if (tone === 'waiting' || tone === 'stopped') ring = <Pulse style={styles.layer}>{full}</Pulse>;
  else if (tone === 'verified') ring = full;
  else ring = null;

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={`${title}${caption ? `. ${caption}` : ''}`}>
      <GlowBlob color={color} opacity={tone === 'verified' ? 0.28 : 0.16} size={GLOW} style={styles.glow} />
      <View style={[styles.glass, { backgroundColor: withAlpha(color, 0.06) }]}>
        {track}
        {ring}
        <View style={[styles.iconWrap, { backgroundColor: withAlpha(color, 0.12) }]}>
          <Icon name={icon} size={30} color={color} />
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {caption ? (
          <Text style={styles.caption} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, marginVertical: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  glow: { position: 'absolute', top: (SIZE - GLOW) / 2, left: (SIZE - GLOW) / 2 },
  glass: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 6,
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.6),
  },
  layer: { ...StyleSheet.absoluteFill },
  track: { ...StyleSheet.absoluteFill, borderRadius: radius.full, borderWidth: STROKE },
  arc: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.full,
    borderWidth: STROKE,
    borderColor: 'transparent',
  },
  iconWrap: { width: 52, height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  title: { ...textSize.base, fontFamily: fonts.heading.bold, color: colors.foreground, textAlign: 'center' },
  caption: { ...textSize.xs, fontFamily: fonts.sans.medium, color: colors.mutedForeground, textAlign: 'center' },
});
