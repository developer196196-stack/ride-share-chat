import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  createSignedDownloadUrl,
  createSignedUploadUrl,
  storageFileExists,
  userAvatarStoragePrefix,
  userDocPath,
  type DecodedIdToken,
  type UserDoc,
} from '@workspace/firebase';
import type { ErrorResponseBody } from '../common/error-response';
import { validationError } from '../common/zod-parse';
import { FIRESTORE } from '../firebase/firebase.tokens';
import type {
  AuthBootstrapRequestDto,
  ProfilePhotoUploadDto,
  ProfilePhotoUploadRequestDto,
  RiderProfileDto,
  UpdateRiderProfileRequestDto,
} from './auth.types';

const PHOTO_EXTENSIONS: Record<ProfilePhotoUploadRequestDto['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function toIso(value: Timestamp | null | undefined): string {
  return (value ?? Timestamp.now()).toDate().toISOString();
}

function isProfileComplete(doc: Pick<UserDoc, 'displayName' | 'homeCity' | 'rideStyle'>): boolean {
  return Boolean(doc.displayName && doc.homeCity && doc.rideStyle);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore | null) {}

  private db(): Firestore {
    if (!this.firestore) {
      const body: ErrorResponseBody = {
        code: 'FIREBASE_UNAVAILABLE',
        message: 'Firebase Admin is not configured on this server.',
      };
      throw new ServiceUnavailableException(body);
    }
    return this.firestore;
  }

  private userRef(uid: string) {
    return this.db().doc(userDocPath(uid));
  }

  private async readUser(uid: string): Promise<UserDoc> {
    const snap = await this.userRef(uid).get();
    if (!snap.exists) {
      const body: ErrorResponseBody = {
        code: 'USER_NOT_FOUND',
        message: 'No rider record for this account yet. Call POST /v1/auth/bootstrap first.',
      };
      throw new NotFoundException(body);
    }
    return snap.data() as UserDoc;
  }

  private async toProfile(doc: UserDoc): Promise<RiderProfileDto> {
    let photoUrl: string | null = null;
    if (doc.photoStoragePath) {
      try {
        photoUrl = await createSignedDownloadUrl(doc.photoStoragePath);
      } catch (error) {
        this.logger.warn(
          `Could not sign avatar URL for ${doc.uid}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      uid: doc.uid,
      phoneNumber: doc.phoneNumber ?? null,
      countryCode: doc.countryCode ?? null,
      displayName: doc.displayName ?? null,
      homeCity: doc.homeCity ?? null,
      rideStyle: doc.rideStyle ?? null,
      incognitoDropoff: doc.incognitoDropoff ?? true,
      photoUrl,
      profileComplete: isProfileComplete(doc),
      createdAt: toIso(doc.createdAt),
      updatedAt: toIso(doc.updatedAt),
    };
  }

  /** Creates `users/{uid}` on first sign-in; refreshes the verified phone on later calls. */
  async bootstrap(user: DecodedIdToken, body: AuthBootstrapRequestDto): Promise<RiderProfileDto> {
    const ref = this.userRef(user.uid);
    const phoneNumber = user.phone_number ?? null;

    await this.db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        const doc: UserDoc = {
          uid: user.uid,
          phoneNumber,
          countryCode: body.countryCode ?? null,
          displayName: null,
          displayNameLower: null,
          homeCity: null,
          rideStyle: null,
          incognitoDropoff: true,
          photoStoragePath: null,
          profileCompletedAt: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        tx.set(ref, doc);
        return;
      }

      const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (phoneNumber) update.phoneNumber = phoneNumber;
      if (body.countryCode) update.countryCode = body.countryCode;
      tx.update(ref, update);
    });

    return this.toProfile(await this.readUser(user.uid));
  }

  async getMe(user: DecodedIdToken): Promise<RiderProfileDto> {
    return this.toProfile(await this.readUser(user.uid));
  }

  async updateMe(
    user: DecodedIdToken,
    body: UpdateRiderProfileRequestDto,
  ): Promise<RiderProfileDto> {
    const current = await this.readUser(user.uid);
    const displayName = body.displayName.trim();
    const homeCity = body.homeCity.trim();

    const update: Record<string, unknown> = {
      displayName,
      displayNameLower: displayName.toLowerCase(),
      homeCity,
      rideStyle: body.rideStyle,
      incognitoDropoff: body.incognitoDropoff,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.photoStoragePath !== undefined) {
      if (!body.photoStoragePath.startsWith(userAvatarStoragePrefix(user.uid))) {
        validationError('photoStoragePath does not belong to this account.', {
          field: 'photoStoragePath',
        });
      }
      if (!(await storageFileExists(body.photoStoragePath))) {
        validationError('Profile photo upload was not found. Upload it again.', {
          field: 'photoStoragePath',
        });
      }
      update.photoStoragePath = body.photoStoragePath;
    }

    if (!current.profileCompletedAt) {
      update.profileCompletedAt = FieldValue.serverTimestamp();
    }

    await this.userRef(user.uid).update(update);
    return this.toProfile(await this.readUser(user.uid));
  }

  async createPhotoUpload(
    user: DecodedIdToken,
    body: ProfilePhotoUploadRequestDto,
  ): Promise<ProfilePhotoUploadDto> {
    // Firestore must be available too — the path is only useful with updateMe.
    this.db();
    const storagePath = `${userAvatarStoragePrefix(user.uid)}${Date.now()}.${PHOTO_EXTENSIONS[body.contentType]}`;
    try {
      const { uploadUrl, expiresAt } = await createSignedUploadUrl(storagePath, body.contentType);
      return { uploadUrl, storagePath, expiresAt: expiresAt.toISOString() };
    } catch (error) {
      this.logger.error(
        `Signed upload URL failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      const errorBody: ErrorResponseBody = {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Could not prepare the photo upload. Check FIREBASE_STORAGE_BUCKET on the server.',
      };
      throw new ServiceUnavailableException(errorBody);
    }
  }
}
