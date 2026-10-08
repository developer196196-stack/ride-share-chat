import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, withAlpha } from '@/constants/colors';
import { MAX_CONTENT_WIDTH, radius } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Icon } from './Icon';

export type Option<T extends string> = {
  value: T;
  label: string;
  /** Leading text/emoji (e.g. a flag). */
  leading?: React.ReactNode;
  trailing?: string;
};

type Props<T extends string> = {
  visible: boolean;
  title: string;
  options: Option<T>[];
  selected?: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
};

/** Bottom sheet list picker (country code, ride style). */
export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: Props<T>) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        <FlatList
          data={options}
          keyExtractor={(o) => o.value}
          style={styles.list}
          renderItem={({ item }) => {
            const active = item.value === selected;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  active && styles.rowActive,
                  pressed && { backgroundColor: colors.secondary },
                ]}
              >
                {item.leading}
                <Text style={styles.label}>{item.label}</Text>
                {item.trailing ? <Text style={styles.trailing}>{item.trailing}</Text> : null}
                {active ? <Icon name="solarCheckCircleBold" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: withAlpha(colors.black, 0.4),
  },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    maxHeight: '70%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    marginBottom: 12,
  },
  title: {
    ...textSize.base,
    fontFamily: fonts.heading.bold,
    color: colors.foreground,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.xl,
  },
  rowActive: {
    backgroundColor: withAlpha(colors.primary, 0.06),
  },
  label: {
    flex: 1,
    ...textSize.sm,
    fontFamily: fonts.sans.semibold,
    color: colors.foreground,
  },
  trailing: {
    ...textSize.sm,
    fontFamily: fonts.mono.medium,
    color: colors.mutedForeground,
  },
});
