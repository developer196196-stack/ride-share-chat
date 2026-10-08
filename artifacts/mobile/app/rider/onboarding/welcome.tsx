/** Sleek 2 — Onboarding Screen #1 ("Meet While You Move"). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow, tintedShadow } from '@/constants/layout';
import { images } from '@/constants/images';
import { routes } from '@/constants/routes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Icon, LiveDot, Screen } from '@/components/ui';

export default function OnboardingWelcome() {
  const router = useRouter();

  return (
    <Screen spaceBetween contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.livePill}>
          <LiveDot />
          <Text style={styles.livePillText}>Global Telemetry Live</Text>
        </View>
        <Text style={styles.transitTag}>100% In-Transit</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroFrame}>
          <Image source={images.onboardingRooms} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={[withAlpha(colors.black, 0.85), withAlpha(colors.black, 0.2), 'transparent']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={styles.heroOverlay}
          >
            <View style={styles.roomsBadge}>
              <Icon name="solarUsersGroupRoundedBold" size={13} color={colors.primaryForeground} />
              <Text style={styles.roomsBadgeText}>9-Seat Rolling Rooms</Text>
            </View>
            <Text style={styles.heroTitle}>Meet While You Move</Text>
            <Text style={styles.heroBody}>
              Live video chats with verified Uber & Lyft passengers actively in transit.
            </Text>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label="Verify Your Ride & Join"
          icon="solarArrowRightBold"
          iconSize={20}
          height={56}
          weight="extrabold"
          style={tintedShadow(colors.primary, 0.3, 'xl')}
          onPress={() => router.push(routes.howItWorks)}
        />
        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <Icon name="solarShieldCheckBold" size={14} color={colors.accent} />
            <Text style={styles.trustText}>Secure Trip Validation</Text>
          </View>
          <Text style={styles.trustDot}>•</Text>
          <View style={styles.trustItem}>
            <Icon name="solarLockPasswordBold" size={14} color={colors.primary} />
            <Text style={styles.trustText}>24/7 Live Moderation</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.xs,
  },
  livePillText: {
    ...textSize['11'],
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
  },
  transitTag: {
    ...textSize['11'],
    fontFamily: fonts.mono.extrabold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(11),
  },
  heroCard: {
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 12,
    marginVertical: 12,
    ...shadow.xl,
  },
  heroFrame: {
    width: '100%',
    aspectRatio: 9 / 14,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    backgroundColor: colors.black,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: 20,
    alignItems: 'center',
  },
  roomsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.primary, 0.9),
    marginBottom: 10,
    ...shadow.md,
  },
  roomsBadgeText: {
    ...textSize['10'],
    fontFamily: fonts.sans.black,
    color: colors.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.widest(10),
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 24,
    fontFamily: fonts.heading.bold,
    color: colors.white,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: tracking.tight(24),
  },
  heroBody: {
    ...textSize.xs,
    lineHeight: 20,
    fontFamily: fonts.sans.regular,
    color: withAlpha(colors.white, 0.8),
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
  footer: {
    gap: 14,
    marginTop: 12,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 4,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    ...textSize['11'],
    fontFamily: fonts.sans.medium,
    color: colors.mutedForeground,
  },
  trustDot: {
    ...textSize['11'],
    color: colors.border,
  },
});
