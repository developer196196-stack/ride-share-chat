/**
 * Sleek 5 — Profile Setup Screen.
 * Loads GET /v1/auth/me, uploads the avatar through a signed Storage URL, saves with PATCH /v1/auth/me.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  getGetAuthMeQueryKey,
  useBootstrapAuth,
  useGetAuthMe,
  useUpdateAuthMe,
  type RideStyle,
} from '@workspace/api-client-react';
import { colors, withAlpha } from '@/constants/colors';
import { radius, shadow, webInputReset } from '@/constants/layout';
import { RIDE_STYLES, rideStyleOption } from '@/constants/ride-styles';
import { routes } from '@/constants/routes';
import { fonts, textSize, tracking } from '@/constants/typography';
import { Button, Card, ErrorBanner, Icon, OptionSheet, Screen, Toggle } from '@/components/ui';
import { StepFooter, StepHeader, StepIntro } from '@/components/rideshare';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api/error-message';
import { uploadProfilePhoto } from '@/lib/profile/upload-profile-photo';
import { useAuthStore } from '@/stores/auth.store';

/** Mirrors OpenAPI `UpdateRiderProfileRequest`, with user-facing messages. */
const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(3, 'At least 3 characters.')
    .max(24, 'At most 24 characters.')
    .regex(/^[A-Za-z0-9._]+$/, 'Use letters, numbers, dots or underscores only.'),
  homeCity: z.string().trim().min(2, 'Enter your home metro or city.').max(60, 'At most 60 characters.'),
  rideStyle: z.enum(['party_tech', 'networking', 'deep_talks', 'just_chilling'], {
    errorMap: () => ({ message: 'Pick a ride style.' }),
  }),
  incognitoDropoff: z.boolean(),
});

type ProfileForm = z.infer<typeof profileSchema>;

type Photo = { previewUri: string; storagePath: string | null; uploading: boolean };

export default function ProfileSetupScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const me = useGetAuthMe({ query: { queryKey: getGetAuthMeQueryKey(), enabled: isAuthenticated } });
  const bootstrap = useBootstrapAuth();
  const updateMe = useUpdateAuthMe();

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: '', homeCity: '', rideStyle: 'party_tech', incognitoDropoff: true },
  });

  // Signed in on a device where the rider record was never created (e.g. bootstrap failed) — create it now.
  const missingRecord = me.error instanceof ApiError && getApiErrorCode(me.error) === 'USER_NOT_FOUND';
  useEffect(() => {
    if (!missingRecord || bootstrap.isPending || bootstrap.isError) return;
    bootstrap.mutate(
      { data: {} },
      { onSuccess: (profile) => queryClient.setQueryData(getGetAuthMeQueryKey(), profile) },
    );
  }, [bootstrap, missingRecord, queryClient]);

  // Prefill once the saved profile arrives; don't clobber edits in progress.
  useEffect(() => {
    if (!me.data || isDirty) return;
    reset({
      displayName: me.data.displayName ?? '',
      homeCity: me.data.homeCity ?? '',
      rideStyle: me.data.rideStyle ?? 'party_tech',
      incognitoDropoff: me.data.incognitoDropoff,
    });
  }, [isDirty, me.data, reset]);

  const pickPhoto = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPhoto({ previewUri: asset.uri, storagePath: null, uploading: true });
    try {
      const storagePath = await uploadProfilePhoto(asset.uri, asset.mimeType);
      setPhoto({ previewUri: asset.uri, storagePath, uploading: false });
    } catch (err) {
      setPhoto(null);
      setError(getApiErrorMessage(err, 'Could not upload your photo. Try again.'));
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const profile = await updateMe.mutateAsync({
        data: {
          ...values,
          ...(photo?.storagePath ? { photoStoragePath: photo.storagePath } : {}),
        },
      });
      queryClient.setQueryData(getGetAuthMeQueryKey(), profile);
      router.push(routes.rideshareConnect);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save your profile. Try again.'));
    }
  });

  const rideStyleOptions = useMemo(
    () =>
      RIDE_STYLES.map((s) => ({
        value: s.value,
        label: s.label,
        leading: <Icon name={s.icon} size={18} color={s.tint} />,
      })),
    [],
  );

  const avatarUri = photo?.previewUri ?? me.data?.photoUrl ?? null;
  const phoneVerified = Boolean(me.data?.phoneNumber);
  const loadingProfile = isAuthenticated && (me.isLoading || (missingRecord && bootstrap.isPending));
  const loadError =
    me.error && !missingRecord
      ? getApiErrorMessage(me.error, 'Could not load your profile.')
      : bootstrap.error
        ? getApiErrorMessage(bootstrap.error)
        : null;

  if (isAuthReady && !isAuthenticated) {
    return (
      <Screen spaceBetween contentStyle={styles.content}>
        <StepHeader step={2} />
        <View style={styles.body}>
          <StepIntro
            eyebrow="Passenger Verification"
            eyebrowIcon="solarUserCheckBold"
            eyebrowTone="accent"
            title="Set up your profile"
            description="Verify your mobile number first so we can save your rider profile."
          />
        </View>
        <Button label="Verify Phone Number" icon="solarArrowRightBold" onPress={() => router.replace(routes.phoneAuth)} />
      </Screen>
    );
  }

  return (
    <Screen spaceBetween contentStyle={styles.content}>
      <StepHeader step={2} />

      <View style={styles.body}>
        <StepIntro
          eyebrow="Passenger Verification"
          eyebrowIcon="solarUserCheckBold"
          eyebrowTone="accent"
          title="Set up your profile"
          description="Other verified riders will see your display name, city, and active vibe badge."
        />

        {loadingProfile ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading your profile…</Text>
          </View>
        ) : (
          <>
            <View style={styles.avatarBlock}>
              <Pressable onPress={pickPhoto} disabled={photo?.uploading} accessibilityLabel="Change profile photo">
                <View style={styles.avatarRing}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={styles.avatarEmpty}>
                      <Icon name="solarUserCircleLinear" size={44} color={colors.mutedForeground} />
                    </View>
                  )}
                  {photo?.uploading ? (
                    <View style={styles.avatarUploading}>
                      <ActivityIndicator color={colors.white} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.cameraButton}>
                  <Icon name="solarCameraBold" size={16} color={colors.primaryForeground} />
                </View>
                {phoneVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : null}
              </Pressable>
              <View style={styles.liveness}>
                <Icon
                  name={phoneVerified ? 'solarShieldCheckBold' : 'solarCameraBold'}
                  size={14}
                  color={phoneVerified ? colors.accent : colors.primary}
                />
                <Text style={styles.livenessText}>
                  {phoneVerified ? `Phone verified · ${me.data?.phoneNumber}` : 'Tap to add a profile photo'}
                </Text>
              </View>
            </View>

            <View style={styles.fields}>
              <Controller
                control={control}
                name="displayName"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Card style={[styles.field, errors.displayName && styles.fieldError]}>
                    <Text style={styles.label}>Display Name</Text>
                    <TextInput
                      style={styles.nameInput}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="e.g. night_rider"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={24}
                      accessibilityLabel="Display name"
                    />
                    {errors.displayName ? (
                      <Text style={styles.errorText}>{errors.displayName.message}</Text>
                    ) : null}
                  </Card>
                )}
              />

              <View style={styles.fieldRow}>
                <Controller
                  control={control}
                  name="homeCity"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <Card style={[styles.field, styles.half, errors.homeCity && styles.fieldError]}>
                      <Text style={styles.label}>Home Metro / City</Text>
                      <View style={styles.inlineValue}>
                        <Icon name="solarMapPointBold" size={16} color={colors.primary} />
                        <TextInput
                          style={styles.smallInput}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholder="City, State"
                          placeholderTextColor={colors.mutedForeground}
                          maxLength={60}
                          accessibilityLabel="Home metro or city"
                        />
                      </View>
                      {errors.homeCity ? <Text style={styles.errorText}>{errors.homeCity.message}</Text> : null}
                    </Card>
                  )}
                />
                <Controller
                  control={control}
                  name="rideStyle"
                  render={({ field: { value } }) => {
                    const option = rideStyleOption(value);
                    return (
                      <Pressable
                        style={styles.half}
                        onPress={() => setStylePickerOpen(true)}
                        accessibilityLabel={`Ride style ${option.label}`}
                      >
                        <Card style={[styles.field, styles.fill]}>
                          <Text style={styles.label}>Ride Style</Text>
                          <View style={styles.inlineValue}>
                            <Icon name={option.icon} size={16} color={option.tint} />
                            <Text style={styles.smallValue} numberOfLines={1}>
                              {option.label}
                            </Text>
                            <Icon name="solarAltArrowDownLinear" size={12} color={colors.mutedForeground} />
                          </View>
                        </Card>
                      </Pressable>
                    );
                  }}
                />
              </View>

              <Controller
                control={control}
                name="incognitoDropoff"
                render={({ field: { value, onChange } }) => (
                  <View style={styles.shield}>
                    <View style={styles.shieldLeft}>
                      <Icon name="solarEyeClosedBold" size={18} color={colors.mutedForeground} />
                      <View style={styles.shieldText}>
                        <Text style={styles.shieldTitle}>Incognito Drop-off Shield</Text>
                        <Text style={styles.shieldCaption}>Hides exact street addresses from video overlay</Text>
                      </View>
                    </View>
                    <Toggle
                      size="sm"
                      value={value}
                      onValueChange={onChange}
                      accessibilityLabel="Incognito drop-off shield"
                    />
                  </View>
                )}
              />
            </View>
          </>
        )}

        {loadError ? <ErrorBanner message={loadError} /> : null}
        {error ? <ErrorBanner message={error} /> : null}
      </View>

      <StepFooter
        label="Save & Link Rideshare"
        onPress={onSubmit}
        loading={updateMe.isPending}
        disabled={loadingProfile || !me.data || photo?.uploading}
        caption="Profiles are locked to verified vehicle riders only."
      />

      <Controller
        control={control}
        name="rideStyle"
        render={({ field: { value, onChange } }) => (
          <OptionSheet<RideStyle>
            visible={stylePickerOpen}
            title="Ride style"
            options={rideStyleOptions}
            selected={value}
            onSelect={onChange}
            onClose={() => setStylePickerOpen(false)}
          />
        )}
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
    gap: 20,
    marginVertical: 16,
  },
  loading: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  loadingText: {
    ...textSize.xs,
    fontFamily: fonts.sans.medium,
    color: colors.mutedForeground,
  },
  avatarBlock: {
    alignItems: 'center',
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: withAlpha(colors.primary, 0.2),
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
  },
  avatarUploading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.black, 0.4),
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  verifiedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    ...shadow.xs,
  },
  verifiedText: {
    ...textSize['10'],
    fontFamily: fonts.sans.bold,
    color: colors.white,
  },
  liveness: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  livenessText: {
    ...textSize.xs,
    fontFamily: fonts.sans.medium,
    color: colors.mutedForeground,
  },
  fields: {
    gap: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    padding: 14,
  },
  fieldError: {
    borderColor: colors.destructive,
  },
  half: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  label: {
    ...textSize['11'],
    fontFamily: fonts.sans.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider(11),
  },
  nameInput: {
    ...webInputReset,
    ...textSize.sm,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
    marginTop: 4,
    padding: 0,
  },
  inlineValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  smallInput: {
    ...webInputReset,
    flex: 1,
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
    padding: 0,
  },
  smallValue: {
    flex: 1,
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
  },
  errorText: {
    ...textSize['11'],
    fontFamily: fonts.sans.semibold,
    color: colors.destructive,
    marginTop: 6,
  },
  shield: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: radius['2xl'],
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  shieldText: {
    flexShrink: 1,
  },
  shieldTitle: {
    ...textSize.xs,
    fontFamily: fonts.sans.bold,
    color: colors.foreground,
  },
  shieldCaption: {
    ...textSize['11'],
    fontFamily: fonts.sans.regular,
    color: colors.mutedForeground,
  },
});
