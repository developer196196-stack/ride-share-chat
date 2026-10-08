import { Global, Module } from '@nestjs/common';
import {
  getAuth,
  getFirebaseAdmin,
  getFirestore,
  isFirebaseConfigured,
} from '@workspace/firebase';
import {
  FIREBASE_ADMIN,
  FIREBASE_AUTH,
  FIREBASE_CONFIGURED,
  FIRESTORE,
} from './firebase.tokens';

@Global()
@Module({
  providers: [
    {
      provide: FIREBASE_CONFIGURED,
      useFactory: () => isFirebaseConfigured(),
    },
    {
      provide: FIREBASE_ADMIN,
      useFactory: () => {
        if (!isFirebaseConfigured()) {
          return null;
        }
        return getFirebaseAdmin();
      },
    },
    {
      provide: FIRESTORE,
      useFactory: () => {
        if (!isFirebaseConfigured()) {
          return null;
        }
        return getFirestore();
      },
    },
    {
      provide: FIREBASE_AUTH,
      useFactory: () => {
        if (!isFirebaseConfigured()) {
          return null;
        }
        return getAuth();
      },
    },
  ],
  exports: [FIREBASE_CONFIGURED, FIREBASE_ADMIN, FIRESTORE, FIREBASE_AUTH],
})
export class FirebaseModule {}
