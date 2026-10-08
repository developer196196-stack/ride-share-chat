import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { routes } from '@/constants/routes';
import { fonts, textSize } from '@/constants/typography';
import { IconButton } from '@/components/ui';

/** Back button + title/subtitle header for account and settings screens. */
export function AccountHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <IconButton
          icon="solarArrowLeftLinear"
          shape="rounded"
          color={colors.foreground}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(routes.settings))}
        />
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  text: { flexShrink: 1 },
  title: { ...textSize.lg, fontFamily: fonts.heading.bold, color: colors.foreground },
  subtitle: { ...textSize['11'], fontFamily: fonts.sans.regular, color: colors.mutedForeground },
});
