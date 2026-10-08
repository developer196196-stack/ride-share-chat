/** Sleek 7 — Permissions Screen. Requests camera/mic, GPS and motion; GPS is required. */
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, withAlpha } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { routes } from '@/constants/routes';
import type { IconName } from '@/constants/icons';
import { fonts, textSize } from '@/constants/typography';
import { Card, ErrorBanner, Icon, Screen, Toggle } from '@/components/ui';
import { StepFooter, StepHeader, StepIntro } from '@/components/rideshare';
import { getPermissionStatus, requestPermission, type PermissionKey, type PermissionStatusMap } from '@/lib/permissions';

const PERMISSIONS: { key: PermissionKey; icon: IconName; tint: string; title: string; caption: string; required?: boolean }[] = [
  {
    key: 'media',
    icon: 'solarVideocameraBold',
    tint: colors.primary,
    title: 'Camera & Microphone',
    caption: 'Stream HD video and audio in active room',
  },
  {
    key: 'location',
    icon: 'solarCompassBold',
    tint: colors.accent,
    title: 'High-Precision GPS',
    caption: 'Verifies vehicle speed > 10 MPH in transit',
    required: true,
  },
  {
    key: 'motion',
    icon: 'solarRunning2Bold',
    tint: colors.primary,
    title: 'Motion & Activity',
    caption: 'Micro-vibrations and in-vehicle detection',
  },
];

export default function PermissionsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<PermissionStatusMap | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getPermissionStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
    // Re-check when returning from system settings.
    const sub = AppState.addEventListener('change', (next) => next === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const ask = async (key: PermissionKey) => {
    setError(null);
    await requestPermission(key);
    refresh();
  };

  const launch = async () => {
    setBusy(true);
    setError(null);
    try {
      let current = status ?? (await getPermissionStatus());
      for (const p of PERMISSIONS) {
        if (!current[p.key]) await requestPermission(p.key);
      }
      current = await getPermissionStatus();
      setStatus(current);
      if (!current.location) {
        setError('Location access is required to verify that you are in transit.');
        return;
      }
      router.push(routes.validation);
    } finally {
      setBusy(false);
    }
  };

  const allGranted = status ? Object.values(status).every(Boolean) : false;

  return (
    <Screen spaceBetween contentStyle={styles.content}>
      <StepHeader step={4} />

      <View style={styles.body}>
        <StepIntro
          eyebrow="Hardware Telemetry Handshake"
          eyebrowIcon="solarShieldWarningBold"
          eyebrowTone="accent"
          title="Device permissions"
          description="Required to calculate real-time speed, anti-couch spoofing, and 10-seater video rooms."
        />

        <View style={styles.list}>
          {PERMISSIONS.map((p) => {
            const granted = status?.[p.key] ?? false;
            return (
              <Card key={p.key} style={styles.item}>
                <Pressable style={styles.itemLeft} onPress={() => !granted && void ask(p.key)} disabled={granted}>
                  <View style={[styles.itemIcon, { backgroundColor: withAlpha(p.tint, 0.1) }]}>
                    <Icon name={p.icon} size={22} color={p.tint} />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle}>
                      {p.title}
                      {p.required ? <Text style={styles.required}>  Required</Text> : null}
                    </Text>
                    <Text style={styles.itemCaption}>{p.caption}</Text>
                  </View>
                </Pressable>
                <Toggle
                  value={granted}
                  onValueChange={() => (granted ? void Linking.openSettings() : void ask(p.key))}
                  accessibilityLabel={`${p.title} permission`}
                />
              </Card>
            );
          })}
        </View>

        <View style={styles.ready}>
          <View style={styles.readyLeft}>
            <Icon
              name={allGranted ? 'solarCheckCircleBold' : 'solarShieldWarningBold'}
              size={18}
              color={allGranted ? colors.accent : colors.chart3}
            />
            <Text style={styles.readyText}>
              {allGranted ? 'Trip Validation Engine Ready' : 'Grant access to start validation'}
            </Text>
          </View>
          <Text style={[styles.readyTag, !allGranted && { color: colors.mutedForeground }]}>
            {allGranted ? 'Ready to Launch' : 'Pending'}
          </Text>
        </View>

        {error ? <ErrorBanner message={error} /> : null}
      </View>

      <StepFooter
        label="Launch Trip Validation"
        icon="solarRocketBold"
        onPress={launch}
        loading={busy}
        caption="Permissions are active only while a ride is validated."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  body: { gap: 20, marginVertical: 16 },
  list: { gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1, flex: 1 },
  itemIcon: { width: 44, height: 44, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  itemText: { flexShrink: 1 },
  itemTitle: { ...textSize.sm, fontFamily: fonts.sans.bold, color: colors.foreground },
  required: { ...textSize['10'], fontFamily: fonts.sans.bold, color: colors.primary },
  itemCaption: { ...textSize.xs, fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  ready: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
  },
  readyLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  readyText: { ...textSize.xs, fontFamily: fonts.sans.semibold, color: colors.foreground },
  readyTag: { ...textSize['11'], fontFamily: fonts.sans.bold, color: colors.primary, textTransform: 'uppercase' },
});
