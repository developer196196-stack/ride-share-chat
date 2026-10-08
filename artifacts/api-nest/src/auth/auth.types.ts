/** DTOs aligned with OpenAPI auth schemas (lib/api-spec/openapi.yaml). */
import type { RideStyle } from '@workspace/firebase';

export type AuthBootstrapRequestDto = {
  countryCode?: string;
};

export type UpdateRiderProfileRequestDto = {
  displayName: string;
  homeCity: string;
  rideStyle: RideStyle;
  incognitoDropoff: boolean;
  photoStoragePath?: string;
};

export type ProfilePhotoUploadRequestDto = {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
};

export type RiderProfileDto = {
  uid: string;
  phoneNumber: string | null;
  countryCode: string | null;
  displayName: string | null;
  homeCity: string | null;
  rideStyle: RideStyle | null;
  incognitoDropoff: boolean;
  photoUrl: string | null;
  profileComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProfilePhotoUploadDto = {
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
};
