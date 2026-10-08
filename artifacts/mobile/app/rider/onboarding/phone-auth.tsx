/**
 * Sleek 4 — Authentication Screen.
 * Firebase phone OTP → POST /v1/auth/bootstrap → Profile Setup (or Rideshare Connect when complete).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAuthMeQueryKey,
  useBootstrapAuth,
  type RiderProfile,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  formatNationalNumber,
  isValidNationalNumber,
  toE164,
  type Country,
} from '@/constants/countries';
import { radius, webInputReset } from '@/constants/layout';
import { routes } from '@/constants/routes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { FirebaseRecaptchaVerifier } from '@/components/firebase/FirebaseRecaptchaVerifier';
import type { FirebaseRecaptchaVerifierHandle } from '@/components/firebase/firebase-recaptcha.types';
import { Card, ErrorBanner, Icon, OptionSheet, Screen } from '@/components/ui';
import { OtpInput, StepFooter, StepHeader, StepIntro } from '@/components/rideshare';
import { mapFirebasePhoneAuthError, useFirebasePhoneAuth } from '@/hooks/use-firebase-phone-auth';
import { getApiErrorMessage } from '@/lib/api/error-message';
import { env } from '@/lib/config/env';
import { isFirebaseClientConfigured } from '@/lib/firebase/client';
import { useAuthStore } from '@/stores/auth.store';

const OTP_LENGTH = 6;

type Step = 'phone' | 'code';

export default function PhoneAuthScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierHandle | null>(null);
  const otpRef = useRef<TextInput>(null);
  const { sendCode, verifyCode, reset } = useFirebasePhoneAuth(recaptchaRef);
  const bootstrap = useBootstrapAuth();

  const authUser = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState(false);

  const firebaseReady = isFirebaseClientConfigured();
  const phoneValid = isValidNationalNumber(country, phone);
  const e164 = toE164(country, phone);
  const busy = sending || verifying || bootstrap.isPending;

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  /** Create/refresh the rider record, then continue to the right onboarding step. */
  const finishSignIn = useCallback(async () => {
    const profile: RiderProfile = await bootstrap.mutateAsync({ data: { countryCode: country.iso } });
    queryClient.setQueryData(getGetAuthMeQueryKey(), profile);
    router.replace(profile.profileComplete ? routes.rideshareConnect : routes.profileSetup);
  }, [bootstrap, country.iso, queryClient, router]);

  const handleSend = useCallback(async () => {
    if (!phoneValid || busy) return;
    setError(null);
    setCodeError(false);
    setSending(true);
    try {
      await sendCode(e164);
      setStep('code');
      setCode('');
      setResendIn(env.otpResendSeconds);
      setTimeout(() => otpRef.current?.focus(), 250);
    } catch (err) {
      setError(mapFirebasePhoneAuthError(err));
    } finally {
      setSending(false);
    }
  }, [busy, e164, phoneValid, sendCode]);

  const handleVerify = useCallback(
    async (smsCode: string) => {
      if (smsCode.length !== OTP_LENGTH || busy) return;
      setError(null);
      setCodeError(false);
      setVerifying(true);
      try {
        await verifyCode(smsCode);
      } catch (err) {
        setVerifying(false);
        setCodeError(true);
        setError(mapFirebasePhoneAuthError(err));
        return;
      }
      try {
        await finishSignIn();
      } catch (err) {
        setError(getApiErrorMessage(err, 'Signed in, but we could not create your profile. Try again.'));
      } finally {
        setVerifying(false);
      }
    },
    [busy, finishSignIn, verifyCode],
  );

  const handleCodeChange = (next: string) => {
    setCode(next);
    setCodeError(false);
    if (next.length === OTP_LENGTH) {
      void handleVerify(next);
    }
  };

  const handlePhoneChange = (text: string) => {
    setPhone(formatNationalNumber(country, text));
    // Editing the number after a code was sent starts over.
    if (step === 'code') {
      setStep('phone');
      setCode('');
      setResendIn(0);
      reset();
    }
  };

  const handleContinueSignedIn = async () => {
    setError(null);
    try {
      await finishSignIn();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const countryOptions = useMemo(
    () =>
      COUNTRIES.map((c) => ({
        value: c.iso,
        label: c.name,
        trailing: c.dialCode,
        leading: <Text style={styles.flag}>{c.flag}</Text>,
      })),
    [],
  );

  const primary =
    step === 'phone'
      ? { label: 'Send Verification Code', onPress: handleSend, disabled: !phoneValid || !firebaseReady }
      : {
          label: 'Verify & Create Profile',
          onPress: () => handleVerify(code),
          disabled: code.length !== OTP_LENGTH,
        };

  return (
    <Screen spaceBetween contentStyle={styles.content}>
      <StepHeader step={1} />

      <View style={styles.body}>
        <StepIntro
          eyebrow="Secure Transit Identity"
          eyebrowIcon="solarShieldCheckBold"
          eyebrowTone="primary"
          title="Enter your mobile number"
          description="We will send a 6-digit verification code to confirm your device and link your active transit credentials."
        />

        {!firebaseReady ? (
          <ErrorBanner
            tone="warning"
            message="Firebase is not configured. Add the EXPO_PUBLIC_FIREBASE_* values to artifacts/mobile/.env and restart Expo."
          />
        ) : null}

        {authUser ? (
          <Card style={styles.signedIn}>
            <View style={styles.signedInRow}>
              <Icon name="solarCheckCircleBold" size={18} color={colors.accent} />
              <Text style={styles.signedInText}>
                Signed in as <Text style={styles.signedInPhone}>{authUser.phoneNumber ?? 'this device'}</Text>
              </Text>
            </View>
            <View style={styles.signedInActions}>
              <Pressable onPress={handleContinueSignedIn} disabled={busy} hitSlop={6}>
                <Text style={styles.link}>Continue</Text>
              </Pressable>
              <Pressable onPress={() => void signOut()} disabled={busy} hitSlop={6}>
                <Text style={styles.linkMuted}>Use a different number</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        <View style={styles.fields}>
          <Card style={styles.fieldCard}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <Pressable
                style={styles.countryPicker}
                onPress={() => setPickerOpen(true)}
                disabled={busy}
                accessibilityLabel={`Country code ${country.name} ${country.dialCode}`}
              >
                <Text style={styles.flag}>{country.flag}</Text>
                <Text style={styles.countryCode}>{country.dialCode}</Text>
                <Icon name="solarAltArrowDownLinear" size={14} color={colors.mutedForeground} />
              </Pressable>
              <TextInput
                style={styles.phoneInput}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                placeholder={country.dialCode === '+1' ? '(555) 000-0000' : 'Mobile number'}
                placeholderTextColor={colors.mutedForeground}
                value={phone}
                onChangeText={handlePhoneChange}
                editable={!busy}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                accessibilityLabel="Mobile number"
              />
            </View>
          </Card>

          <Card style={[styles.fieldCard, step === 'phone' && styles.fieldCardIdle]}>
            <View style={styles.otpHeader}>
              <Text style={styles.label}>Verification Code</Text>
              {step === 'code' ? (
                <Pressable onPress={handleSend} disabled={resendIn > 0 || busy} hitSlop={8}>
                  <Text style={[styles.resend, (resendIn > 0 || busy) && styles.resendDisabled]}>
                    {resendIn > 0 ? `Resend (${resendIn}s)` : 'Resend'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <OtpInput
              ref={otpRef}
              value={code}
              onChange={handleCodeChange}
              length={OTP_LENGTH}
              editable={step === 'code' && !busy}
              hasError={codeError}
            />
            {step === 'code' ? (
              <Text style={styles.hint}>
                Code sent to <Text style={styles.hintStrong}>{e164}</Text>
              </Text>
            ) : (
              <Text style={styles.hint}>Tap Send Verification Code to receive an SMS.</Text>
            )}
          </Card>

          <FirebaseRecaptchaVerifier ref={recaptchaRef} />

          {error ? <ErrorBanner message={error} /> : null}

          <View style={styles.notice}>
            <Icon name="solarLockKeyholeBold" size={18} color={colors.primary} />
            <Text style={styles.noticeText}>
              Your phone number is encrypted and never shared with other passengers in video rooms.
            </Text>
          </View>
        </View>
      </View>

      <StepFooter
        label={primary.label}
        onPress={primary.onPress}
        disabled={primary.disabled}
        loading={busy}
        caption={
          <>
            By signing in, you accept our <Text style={styles.legalLink}>Transit Safety Code</Text> &{' '}
            <Text style={styles.legalLink}>Privacy Terms</Text>.
          </>
        }
      />

      <OptionSheet
        visible={pickerOpen}
        title="Country code"
        options={countryOptions}
        selected={country.iso}
        onSelect={(iso) => {
          const next = COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY;
          setCountry(next);
          setPhone((p) => formatNationalNumber(next, p));
        }}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  body: {
    gap: 24,
    marginVertical: 16,
  },
  fields: {
    gap: 16,
  },
  fieldCard: {
    padding: 16,
    gap: 12,
  },
  fieldCardIdle: {
    opacity: 0.85,
  },
  label: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(12),
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flag: {
    ...textSize.base,
  },
  countryCode: {
    ...textSize.sm,
    fontFamily: fonts.sans.semibold,
    color: colors.foreground,
  },
  phoneInput: {
    ...webInputReset,
    flex: 1,
    ...textSize.base,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
    padding: 0,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resend: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.primary,
  },
  resendDisabled: {
    color: colors.mutedForeground,
  },
  hint: {
    ...textSize['11'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  hintStrong: {
    fontFamily: fonts.mono.bold,
    color: colors.foreground,
  },
  signedIn: {
    padding: 14,
    gap: 10,
    borderColor: withAlpha(colors.accent, 0.4),
  },
  signedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signedInText: {
    flex: 1,
    ...textSize.xs,
    fontFamily: fonts.sans.medium,
    color: colors.foreground,
  },
  signedInPhone: {
    fontFamily: fonts.mono.bold,
  },
  signedInActions: {
    flexDirection: 'row',
    gap: 20,
    paddingLeft: 26,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: withAlpha(colors.secondary, 0.8),
    borderWidth: 1,
    borderColor: withAlpha(colors.border, 0.8),
  },
  noticeText: {
    flex: 1,
    ...textSize.xs,
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
  link: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.primary,
  },
  legalLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  linkMuted: {
    ...textSize.xs,
    fontFamily: fonts.sans.semibold,
    color: colors.mutedForeground,
  },
});
