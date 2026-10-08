import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { fonts, textSize } from '@/constants/typography';
import { Button, Card, Icon } from '@/components/ui';

/** Shown on account screens when nobody is signed in. */
export function SignInRequired({ message }: { message: string }) {
  const router = useRouter();
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Icon name="solarLockKeyholeBold" size={18} color={colors.primary} />
        <Text style={styles.text}>{message}</Text>
      </View>
      <Button label="Verify Phone Number" height={44} borderRadius={radius.xl} size="sm" onPress={() => router.replace(routes.phoneAuth)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, ...textSize.sm, fontFamily: fonts.sans.medium, color: colors.foreground },
});
