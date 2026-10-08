import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from '@workspace/firebase';
import { verifyIdToken } from '@workspace/firebase';
import { FIREBASE_CONFIGURED } from '../firebase/firebase.tokens';
import type { ErrorResponseBody } from '../common/error-response';

export type AuthenticatedRequest = {
  headers: { authorization?: string };
  user?: DecodedIdToken;
};

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    @Inject(FIREBASE_CONFIGURED) private readonly firebaseConfigured: boolean,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.firebaseConfigured) {
      const body: ErrorResponseBody = {
        code: 'FIREBASE_UNAVAILABLE',
        message: 'Firebase Admin is not configured on this server.',
      };
      throw new ServiceUnavailableException(body);
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      this.logger.warn('AUTH_UNAUTHORIZED — missing Bearer header');
      const body: ErrorResponseBody = {
        code: 'AUTH_UNAUTHORIZED',
        message: 'Missing or invalid Authorization Bearer token.',
      };
      throw new UnauthorizedException(body);
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      this.logger.warn('AUTH_UNAUTHORIZED — empty Bearer token');
      const body: ErrorResponseBody = {
        code: 'AUTH_UNAUTHORIZED',
        message: 'Missing or invalid Authorization Bearer token.',
      };
      throw new UnauthorizedException(body);
    }

    try {
      request.user = await verifyIdToken(token);
      return true;
    } catch (error) {
      this.logger.warn(
        `AUTH_UNAUTHORIZED — verifyIdToken failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      const body: ErrorResponseBody = {
        code: 'AUTH_UNAUTHORIZED',
        message: 'Firebase ID token is invalid or expired.',
      };
      throw new UnauthorizedException(body);
    }
  }
}
