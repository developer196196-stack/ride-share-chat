/**
 * Sleek 1 — Splash Screen. After a short delay it routes by state: first launch → intro,
 * signed out → Sign-in, signed in → profile / permissions / Trip Validation (see lib/onboarding.ts).
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuthMe } from '@workspace/api-client-react';
import { Image } from 'expo-image';
import { colors } from '@/constants/colors';
import { images } from '@/constants/images';
import { routes } from '@/constants/routes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Screen } from '@/components/ui';
import { getOnboardingFlags, routeForSignedInRider } from '@/lib/onboarding';
import { useAuthStore } from '@/stores/auth.store';

const AUTO_ADVANCE_MS = 3000;

export default function SplashScreen() {
  const router = useRouter();
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [delayDone, setDelayDone] = React.useState(false);
  const navigated = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDelayDone(true), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, []);

  const go = useCallback(async () => {
    if (navigated.current) return;
    navigated.current = true;
    const flags = await getOnboardingFlags();
    if (!isAuthenticated) {
      router.replace(flags.introSeen ? routes.phoneAuth : routes.welcome);
      return;
    }
    try {
      const me = await getAuthMe();
      router.replace(routeForSignedInRider(me.profileComplete, flags));
    } catch (err) {
      // Signed in with Firebase but the server rejects us (no rider record yet): finish sign-in.
      const status = (err as { status?: number }).status;
      if (status && status < 500) {
        router.replace(routes.phoneAuth);
        return;
      }
      // Offline or API down: trust what we know locally.
      router.replace(flags.permissionsDone ? routes.discover : routes.permissions);
    }
  }, [isAuthenticated, router]);

  // Wait for Firebase to restore the session so a signed-in rider never flashes the sign-in screen.
  useEffect(() => {
    if (delayDone && isAuthReady) void go();
  }, [delayDone, isAuthReady, go]);

  return (
    <Screen spaceBetween contentStyle={styles.content} background={<View style={styles.white} />}>
      <View />

      <Pressable style={styles.center} onPress={() => isAuthReady && void go()}>
        <Image source={images.logoFull} style={styles.logo} contentFit="contain" />
        <Text style={styles.tagline}>Connect on Every Journey™</Text>
      </Pressable>

      <View style={styles.poweredBy}>
        <Text style={styles.poweredLabel}>Powered by</Text>
        <Image source={images.smartAiMatch} style={styles.poweredLogo} contentFit="contain" />
      </View>
    </Screen>
  );
}

/** Client splash design (assets/brand/SCR-ONB-01-V3): white, logo, tagline, "Powered by SmartAIMatch". */
const styles = StyleSheet.create({
  white: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
  },
  center: {
    width: '100%',
    alignItems: 'center',
    gap: 28,
  },
  logo: {
    width: '72%',
    maxWidth: 280,
    aspectRatio: 1,
  },
  tagline: {
    ...textSize.xl,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
    textAlign: 'center',
  },
  poweredBy: {
    alignItems: 'center',
    gap: 10,
  },
  poweredLabel: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.widest(12),
  },
  poweredLogo: {
    width: 180,
    aspectRatio: 434 / 123,
  },
});
