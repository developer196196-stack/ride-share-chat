import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/constants/colors';
import { radius } from '@/constants/layout';
import { fonts, textSize } from '@/constants/typography';
import { Pulse } from '@/components/ui';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  editable?: boolean;
  hasError?: boolean;
};

/**
 * Six Sleek OTP cells backed by one hidden TextInput, so paste and
 * iOS/Android SMS autofill (`oneTimeCode`) fill every cell at once.
 */
export const OtpInput = forwardRef<TextInput, Props>(function OtpInput(
  { value, onChange, length = 6, editable = true, hasError = false },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      style={styles.row}
      disabled={!editable}
      onPress={() => (ref && 'current' in ref ? ref.current?.focus() : undefined)}
      accessibilityLabel="Verification code"
    >
      {Array.from({ length }, (_, i) => {
        const digit = value[i];
        const isCursor = editable && focused && i === Math.min(value.length, length - 1) && !digit;
        const borderColor = hasError
          ? colors.destructive
          : digit
            ? colors.primary
            : isCursor
              ? colors.primary
              : colors.border;
        return (
          <View key={i} style={[styles.cell, { borderColor }, !editable && styles.cellDisabled]}>
            {digit ? (
              <Text style={styles.digit}>{digit}</Text>
            ) : isCursor ? (
              <Pulse>
                <Text style={[styles.digit, styles.cursor]}>|</Text>
              </Pulse>
            ) : null}
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDisabled: {
    opacity: 0.5,
  },
  digit: {
    ...textSize.lg,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
  },
  cursor: {
    color: colors.mutedForeground,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
    color: 'transparent',
  },
});
