import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, withAlpha } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { fonts, textSize, tracking } from '@/constants/typography';
import type { IconName } from '@/constants/icons';
import { Icon } from './Icon';

type Tone = 'primary' | 'accent' | 'warning' | 'neutral' | 'solidPrimary' | 'destructive';

type Props = {
  label: string;
  tone?: Tone;
  icon?: IconName;
  iconSize?: number;
  /** Tailwind `uppercase tracking-wide` badge style used for section eyebrows. */
  uppercase?: boolean;
  bordered?: boolean;
  size?: '10' | '11' | 'xs';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  primary: { bg: withAlpha(colors.primary, 0.1), fg: colors.primary, border: withAlpha(colors.primary, 0.2) },
  accent: { bg: withAlpha(colors.accent, 0.1), fg: colors.accent, border: withAlpha(colors.accent, 0.2) },
  warning: { bg: withAlpha(colors.chart3, 0.1), fg: colors.chart3, border: withAlpha(colors.chart3, 0.3) },
  destructive: {
    bg: withAlpha(colors.destructive, 0.1),
    fg: colors.destructive,
    border: withAlpha(colors.destructive, 0.2),
  },
  neutral: { bg: colors.secondary, fg: colors.mutedForeground, border: colors.border },
  solidPrimary: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
};

/** Rounded-full status/eyebrow badge (e.g. "Secure Transit Identity"). */
export function Pill({
  label,
  tone = 'primary',
  icon,
  iconSize = 14,
  uppercase = false,
  bordered = false,
  size = '11',
  style,
  textStyle,
}: Props) {
  const t = TONES[tone];
  const fontSize = textSize[size].fontSize;
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: t.bg },
        bordered && { borderWidth: 1, borderColor: t.border },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={iconSize} color={t.fg} /> : null}
      <Text
        style={[
          styles.text,
          textSize[size],
          { color: t.fg },
          uppercase && { textTransform: 'uppercase', letterSpacing: tracking.wide(fontSize) },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  text: {
    fontFamily: fonts.sans.bold,
  },
});
