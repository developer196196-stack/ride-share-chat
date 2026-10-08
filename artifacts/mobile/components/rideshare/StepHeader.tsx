import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { fonts, textSize, tracking } from '@/constants/typography';
import { IconButton } from '@/components/ui';
import { LogoTile } from './LogoTile';

/** Back button · RS Chats logo · "Step n/4" header shared by the sign-up screens (4–7). */
export function StepHeader({ step, total = 4 }: { step: number; total?: number }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <IconButton icon="solarArrowLeftLinear" onPress={() => router.back()} />
      <View style={styles.brand}>
        <LogoTile size={32} elevation={null} />
        <Text style={styles.brandText}>RS Chats</Text>
      </View>
      <Text style={styles.step}>
        Step {step}/{total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    ...textSize.sm,
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    letterSpacing: tracking.tight(14),
  },
  step: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.mutedForeground,
  },
});
