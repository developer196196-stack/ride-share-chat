/**
 * Sleek 6 — Rideshare Connect, repurposed for the platform-agnostic scope (plan v2.1):
 * no Uber/Lyft API linking. Riders pick which services they use (for statistics only);
 * verification relies entirely on the Trip Validation Engine.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Card, Divider, Icon, Pill, Screen } from '@/components/ui';
import { StepFooter, StepHeader, StepIntro } from '@/components/rideshare';

const PLATFORMS: { key: string; label: string; bg: string; fg: string; region: string }[] = [
  { key: 'uber', label: 'Uber', bg: colors.black, fg: colors.white, region: 'Global' },
  { key: 'lyft', label: 'lyft', bg: colors.lyft, fg: colors.white, region: 'US & Canada' },
  { key: 'grab', label: 'Grab', bg: '#00B14F', fg: colors.white, region: 'Southeast Asia' },
  { key: 'ola', label: 'Ola', bg: '#1C1C1C', fg: '#CDDC39', region: 'India' },
  { key: 'bolt', label: 'Bolt', bg: '#34D186', fg: colors.black, region: 'Europe & Africa' },
  { key: 'other', label: 'Other', bg: colors.secondary, fg: colors.foreground, region: 'Any rideshare or taxi' },
];

export default function RideshareConnectScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(['uber']));

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Screen spaceBetween contentStyle={styles.content}>
      <StepHeader step={3} />

      <View style={styles.body}>
        <StepIntro
          eyebrow="Works With Any Rideshare"
          eyebrowIcon="solarLinkCircleBold"
          eyebrowTone="primary"
          title="Which services do you ride with?"
          description="No account linking needed. Rideshare Chats verifies your ride from your phone's own sensors, so it works with every rideshare app, anywhere."
        />

        <Card style={styles.providers}>
          {PLATFORMS.map((p, i) => {
            const active = selected.has(p.key);
            return (
              <React.Fragment key={p.key}>
                {i > 0 ? <Divider /> : null}
                <Pressable style={styles.providerRow} onPress={() => toggle(p.key)} accessibilityRole="checkbox" accessibilityState={{ checked: active }}>
                  <View style={styles.providerLeft}>
                    <View style={[styles.logo, { backgroundColor: p.bg }]}>
                      <Text style={[styles.logoText, { color: p.fg }]}>{p.label}</Text>
                    </View>
                    <View style={styles.providerText}>
                      <Text style={styles.providerName}>{p.key === 'lyft' ? 'Lyft' : p.label}</Text>
                      <Text style={styles.providerCaption}>{p.region}</Text>
                    </View>
                  </View>
                  {active ? (
                    <Icon name="solarCheckCircleBold" size={22} color={colors.accent} />
                  ) : (
                    <View style={styles.unchecked} />
                  )}
                </Pressable>
              </React.Fragment>
            );
          })}
        </Card>

        <View style={styles.notice}>
          <Icon name="solarShieldCheckBold" size={20} color={colors.accent} />
          <Text style={styles.noticeText}>
            We never access your rideshare accounts or payment info. Trip validation uses GPS speed, cabin
            vibration and in-vehicle detection only.
          </Text>
        </View>
        <Pill label="Platform-agnostic · Global" tone="accent" style={styles.pill} />
      </View>

      <StepFooter
        label="Continue to Permissions"
        onPress={() => router.push(routes.permissions)}
        caption="You can ride with any service — this only helps us improve matching."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
  body: { gap: 20, marginVertical: 16 },
  providers: { paddingHorizontal: 14, paddingVertical: 4 },
  providerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10 },
  providerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 },
  logo: { width: 44, height: 44, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  logoText: { ...textSize.xs, fontFamily: fonts.sans.black, letterSpacing: tracking.tight(12) },
  providerText: { flexShrink: 1 },
  providerName: { ...textSize.sm, fontFamily: fonts.heading.bold, color: colors.foreground },
  providerCaption: { ...textSize.xs, fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  unchecked: { width: 20, height: 20, borderRadius: radius.full, borderWidth: 2, borderColor: colors.muted },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.xs,
  },
  noticeText: { flex: 1, ...textSize.xs, fontFamily: fonts.sans.regular, color: colors.mutedForeground },
  pill: { alignSelf: 'center', backgroundColor: withAlpha(colors.accent, 0.1) },
});
