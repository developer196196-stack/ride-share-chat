import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
  DMSans_900Black,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
  JetBrainsMono_800ExtraBold,
} from '@expo-google-fonts/jetbrains-mono';
import { QueryClientProvider } from '@tanstack/react-query';
import { colors } from '@/constants/colors';
import { createQueryClient } from '@/lib/query/query-client';
import { ApiProvider } from '@/providers/ApiProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { RealtimeProvider } from '@/providers/RealtimeProvider';
import { TripSessionHost } from '@/providers/TripSessionHost';
import { SharePrompt } from '@/components/safety/SharePrompt';

// Keep the native splash up until fonts are ready.
SplashScreen.preventAutoHideAsync();

const queryClient = createQueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
    DMSans_900Black,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
    JetBrainsMono_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Web has no native splash to hold; render immediately so Replit Preview never captures an empty root.
  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ApiProvider>
            <RealtimeProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="rider/onboarding" />
                <Stack.Screen name="rider/room" options={{ gestureEnabled: false }} />
                <Stack.Screen name="rider/account" />
              </Stack>
              <TripSessionHost />
              <SharePrompt />
            </GestureHandlerRootView>
            </RealtimeProvider>
          </ApiProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
