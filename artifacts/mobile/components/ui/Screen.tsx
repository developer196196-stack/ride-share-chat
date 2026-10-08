import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/constants/colors';
import { MAX_CONTENT_WIDTH } from '@/constants/layout';

type Props = {
  children: React.ReactNode;
  /** Content padding (Sleek `px-* pt-* pb-*` on <main>). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Stretch content to full height and space children (Sleek `flex-col justify-between`). */
  spaceBetween?: boolean;
  scroll?: boolean;
  background?: React.ReactNode;
  footer?: React.ReactNode;
  edges?: Edge[];
  statusBar?: 'dark' | 'light';
};

/** Root container for every Sleek screen: safe area, background, max-w-md centered column. */
export function Screen({
  children,
  contentStyle,
  spaceBetween = false,
  scroll = true,
  background,
  footer,
  edges = ['top', 'bottom'],
  statusBar = 'dark',
}: Props) {
  const inner = (
    <View style={[styles.column, spaceBetween && styles.spaceBetween, contentStyle]}>
      {children}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar style={statusBar} />
      {background}
      <SafeAreaView style={styles.safe} edges={edges}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {inner}
          </ScrollView>
        ) : (
          inner
        )}
        {footer}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  column: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  spaceBetween: {
    justifyContent: 'space-between',
  },
});
