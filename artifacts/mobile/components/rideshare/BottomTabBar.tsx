import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, withAlpha } from '@/constants/colors';
import { MAX_CONTENT_WIDTH } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import type { IconName } from '@/constants/icons';
import { Icon } from '@/components/ui';
import { routes } from '@/constants/routes';

type Tab = 'home' | 'history' | 'settings';

const TABS: { key: Tab; label: string; icon: IconName; activeIcon: IconName; href: string }[] = [
  { key: 'home', label: 'Home', icon: 'solarHomeSmileBold', activeIcon: 'solarHomeSmileBold', href: routes.vibeSelection },
  { key: 'history', label: 'History', icon: 'solarHistoryLinear', activeIcon: 'solarHistoryLinear', href: routes.connections },
  { key: 'settings', label: 'Settings', icon: 'solarSettingsLinear', activeIcon: 'solarSettingsLinear', href: routes.settings },
];

/** Fixed bottom nav from the Vibe Selection screen (Home · History · Settings). */
export function BottomTabBar({ active }: { active: Tab }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: 12 + insets.bottom }]}>
      <View style={styles.row}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const color = isActive ? colors.primary : colors.mutedForeground;
          return (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => {
                if (!isActive) router.push(tab.href as never);
              }}
            >
              <Icon name={isActive ? tab.activeIcon : tab.icon} size={20} color={color} />
              <Text
                style={[
                  styles.label,
                  { color, fontFamily: isActive ? fonts.sans.bold : fonts.sans.medium },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: withAlpha(colors.background, 0.95),
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  row: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    ...textSize['10'],
  },
});
