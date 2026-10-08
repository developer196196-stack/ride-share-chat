/** Sleek 1 — Splash Screen. Auto-advances to Onboarding #1. */
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow } from '@/constants/layout';
import { images } from '@/constants/images';
import { routes } from '@/constants/routes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { GlowBlob, LiveDot, Pulse, Screen } from '@/components/ui';

const AUTO_ADVANCE_MS = 3000;

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace(routes.welcome), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <Screen
      spaceBetween
      contentStyle={styles.content}
      background={
        <>
          <GlowBlob color={colors.primary} opacity={0.15} size={384} style={styles.glowTopRight} />
          <GlowBlob color={colors.slate400} opacity={0.1} size={384} style={styles.glowBottomLeft} />
        </>
      }
    >
      <View style={styles.topRow}>
        <View style={styles.livePill}>
          <LiveDot />
          <Text style={styles.livePillText}>Global Network Live</Text>
        </View>
      </View>

      <Pressable style={styles.center} onPress={() => router.replace(routes.welcome)}>
        <View style={styles.logoWrap}>
          <GlowBlob color={colors.primary} opacity={0.2} size={380} style={styles.logoGlow} />
          <Image source={images.logoFull} style={styles.logo} contentFit="contain" />
        </View>
      </Pressable>

      <View style={styles.bottom}>
        <View style={styles.progressGroup}>
          <View style={styles.progressTrack}>
            <Pulse style={styles.progressFillWrap}>
              <LinearGradient
                colors={[colors.primary, withAlpha(colors.primary, 0.8)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressFill}
              />
            </Pulse>
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Initializing Trip Validation…</Text>
            <Text style={styles.progressReady}>Ready</Text>
          </View>
        </View>
        <Text style={styles.tagline}>Ride-Only Live Video Matchmaking</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
  },
  glowTopRight: {
    top: -128,
    right: -128,
  },
  glowBottomLeft: {
    bottom: -128,
    left: -128,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.xs,
  },
  livePillText: {
    ...textSize.xs,
    fontFamily: fonts.sans.semibold,
    color: colors.foreground,
    letterSpacing: tracking.wide(12),
  },
  center: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginVertical: 24,
  },
  logoWrap: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    alignSelf: 'center',
  },
  logo: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 288,
  },
  bottom: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
  },
  progressGroup: {
    gap: 8,
  },
  progressTrack: {
    height: 6,
    width: '100%',
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    overflow: 'hidden',
    padding: 2,
  },
  progressFillWrap: {
    height: '100%',
    width: '66.666%',
  },
  progressFill: {
    flex: 1,
    borderRadius: radius.full,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    ...textSize['11'],
    fontFamily: fonts.mono.medium,
    color: colors.mutedForeground,
  },
  progressReady: {
    ...textSize['11'],
    fontFamily: fonts.mono.bold,
    color: colors.accent,
  },
  tagline: {
    ...textSize['11'],
    fontFamily: fonts.sans.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.widest(11),
    textAlign: 'center',
  },
});
