/** Sleek 3 — Onboarding Screen #2 ("Verified rides only"). */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow, tintedShadow } from '@/constants/layout';
import { avatars, images } from '@/constants/images';
import { routes } from '@/constants/routes';
import type { IconName } from '@/constants/icons';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Divider, Icon, LiveDot, Pill, Screen } from '@/components/ui';
import { LogoTile } from '@/components/rideshare';

const FEATURES: { icon: IconName; tint: string; title: string; caption: string }[] = [
  { icon: 'solarUsersGroupRoundedBold', tint: colors.primary, title: '9-Seat', caption: 'Rolling Rooms' },
  { icon: 'solarHourglassLineBold', tint: colors.accent, title: '5 Min', caption: 'Traffic Grace' },
  { icon: 'solarForwardBold', tint: colors.primary, title: 'Instant', caption: 'Fast Escape' },
];

export default function OnboardingHowItWorks() {
  const router = useRouter();
  const next = () => router.push(routes.phoneAuth);

  return (
    <Screen spaceBetween contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <LogoTile size={40} />
          <View>
            <Text style={styles.brandName}>Rideshare Chats</Text>
            <Text style={styles.brandTag}>Global Community</Text>
          </View>
        </View>
        <Pressable style={styles.skip} onPress={next}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.mainCard}>
          <View style={styles.media}>
            <Image source={images.onboardingTransit} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={[withAlpha(colors.black, 0.8), withAlpha(colors.black, 0.2), 'transparent']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={styles.mediaOverlay}
            >
              <View style={styles.mediaCaption}>
                <LiveDot />
                <Text style={styles.mediaCaptionText}>Live from Uber & Lyft rides nationwide</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tags}>
            <Pill label="100% In-Transit" tone="primary" bordered style={styles.tag} />
            <Pill
              label="Zero Couch Lurkers"
              tone="accent"
              style={styles.tag}
              textStyle={{ fontFamily: fonts.sans.semibold }}
            />
          </View>
          <Text style={styles.title}>Verified rides only. Real people moving together.</Text>
          <Text style={styles.description}>
            Our Trip Validation Engine checks speed ({'>'}15 MPH), micro-vibrations, and ride receipts so
            every room member is genuinely moving.
          </Text>

          <Divider style={styles.divider} />
          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.feature}>
                <View style={[styles.featureIcon, { backgroundColor: withAlpha(f.tint, 0.1) }]}>
                  <Icon name={f.icon} size={15} color={f.tint} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureCaption}>{f.caption}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.ridersCard}>
          <View style={styles.ridersLeft}>
            <View style={styles.avatarStack}>
              {[avatars.maya, avatars.you, avatars.elena].map((uri, i) => (
                <Image key={uri} source={{ uri }} style={[styles.avatar, i > 0 && styles.avatarOverlap]} />
              ))}
            </View>
            <View style={styles.ridersText}>
              <Text style={styles.ridersTitle}>1,420+ Passengers riding now</Text>
              <Text style={styles.ridersCities}>NYC · LA · Chicago · Miami · Austin</Text>
            </View>
          </View>
          <View style={styles.ridersDot} />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          <View style={styles.dotActive} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <View style={styles.actions}>
          <Button
            label="How It Works"
            variant="secondary"
            height={48}
            borderRadius={radius.xl}
            size="xs"
            weight="semibold"
            style={styles.actionSecondary}
          />
          <Button
            label="Verify & Enter Ride"
            icon="solarArrowRightBold"
            iconSize={16}
            height={48}
            borderRadius={radius.xl}
            size="xs"
            style={[styles.actionPrimary, tintedShadow(colors.primary, 0.25, 'md')]}
            onPress={next}
          />
        </View>
        <Text style={styles.legal}>
          By continuing, you enable real-time trip motion & video matchmaking permissions.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandName: {
    ...textSize.sm,
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    letterSpacing: tracking.tight(14),
  },
  brandTag: {
    ...textSize['9'],
    fontFamily: fonts.sans.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: tracking.widest(9),
  },
  skip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipText: {
    ...textSize.xs,
    fontFamily: fonts.sans.semibold,
    color: colors.mutedForeground,
  },
  body: {
    gap: 14,
    marginVertical: 12,
  },
  mainCard: {
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    overflow: 'hidden',
    ...shadow.xs,
  },
  media: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.border, 0.6),
    backgroundColor: colors.muted,
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    padding: 12,
  },
  mediaCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaCaptionText: {
    ...textSize.xs,
    fontFamily: fonts.sans.medium,
    color: colors.white,
  },
  tags: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  title: {
    ...textSize.xl,
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    letterSpacing: tracking.tight(20),
  },
  description: {
    ...textSize.xs,
    lineHeight: 20,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  divider: {
    marginTop: 16,
    marginBottom: 12,
  },
  features: {
    flexDirection: 'row',
    gap: 8,
  },
  feature: {
    flex: 1,
    padding: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.secondary,
    alignItems: 'center',
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  featureTitle: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
  },
  featureCaption: {
    ...textSize['10'],
    fontFamily: fonts.sans.medium,
    color: colors.mutedForeground,
  },
  ridersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: radius['2xl'],
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.xs,
  },
  ridersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.card,
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  ridersText: {
    flexShrink: 1,
  },
  ridersTitle: {
    ...textSize.xs,
    fontFamily: fonts.sans.semibold,
    color: colors.foreground,
  },
  ridersCities: {
    ...textSize['10'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  ridersDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  footer: {
    marginTop: 12,
    gap: 14,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dotActive: {
    width: 24,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: withAlpha(colors.mutedForeground, 0.3),
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionSecondary: {
    flex: 1,
    width: undefined,
  },
  actionPrimary: {
    flex: 2,
    width: undefined,
  },
  legal: {
    ...textSize['10'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
