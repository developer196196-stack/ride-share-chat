import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import type { IconName } from '@/constants/icons';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Pill } from '@/components/ui';

type IntroProps = {
  eyebrow: string;
  eyebrowIcon: IconName;
  eyebrowTone: 'primary' | 'accent';
  title: string;
  description: string;
};

/** Eyebrow badge + `text-3xl font-extrabold` title + lead paragraph (sign-up steps 4–7). */
export function StepIntro({ eyebrow, eyebrowIcon, eyebrowTone, title, description }: IntroProps) {
  return (
    <View>
      <Pill
        label={eyebrow}
        icon={eyebrowIcon}
        tone={eyebrowTone}
        bordered
        uppercase
        style={styles.eyebrow}
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

type FooterProps = {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  caption: React.ReactNode;
};

/** Full-width primary CTA with a centered caption underneath. */
export function StepFooter({
  label,
  icon = 'solarArrowRightBold',
  onPress,
  loading,
  disabled,
  caption,
}: FooterProps) {
  return (
    <View style={styles.footer}>
      <Button label={label} icon={icon} onPress={onPress} loading={loading} disabled={disabled} />
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    marginBottom: 12,
  },
  title: {
    ...textSize['3xl'],
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    letterSpacing: tracking.tight(30),
  },
  description: {
    ...textSize.sm,
    lineHeight: 23,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  footer: {
    gap: 12,
  },
  caption: {
    ...textSize['11'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
