import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreCollections, type DecodedIdToken } from '@workspace/firebase';
import type { ErrorResponseBody } from '../common/error-response';
import { FIRESTORE } from '../firebase/firebase.tokens';

const CACHE_MS = 60_000;

/**
 * Admin panel access: after FirebaseAuthGuard, the caller must have a document in `admins/{uid}`
 * (created with `pnpm --filter @workspace/api-nest run admin:grant`). No development bypass.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);
  private readonly cache = new Map<string, { admin: boolean; until: number }>();

  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore | null) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<{ user?: DecodedIdToken }>().user;
    if (!user?.uid) this.deny();

    const cached = this.cache.get(user.uid);
    if (cached && cached.until > Date.now()) {
      if (!cached.admin) this.deny();
      return true;
    }

    let admin = false;
    try {
      admin = Boolean(this.firestore && (await this.firestore.collection(FirestoreCollections.admins).doc(user.uid).get()).exists);
    } catch (error) {
      this.logger.error(`Admin check failed for ${user.uid}: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.cache.set(user.uid, { admin, until: Date.now() + CACHE_MS });
    if (!admin) {
      this.logger.warn(`Admin access denied for ${user.uid} (${user.email ?? 'no email'})`);
      this.deny();
    }
    return true;
  }

  private deny(): never {
    const body: ErrorResponseBody = { code: 'ADMIN_REQUIRED', message: 'This account is not an administrator.' };
    throw new ForbiddenException(body);
  }
}
