import {
  Inject,
  Injectable,
  Logger,
  UnprocessableEntityException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreCollections } from '@workspace/firebase';
import type { ErrorResponseBody } from '../common/error-response';
import { requireFirestore } from '../common/require-firestore';
import { FIRESTORE } from '../firebase/firebase.tokens';
import {
  CatalogSchema,
  catalogProblems,
  DEFAULT_CATALOG,
  LEGACY_VIBES,
  type CategoryCatalog,
} from './room-categories';
import type { Vibe } from './rooms.types';

const CATALOG_DOC = 'roomCategories';
const REFRESH_MS = 60_000;

function invalid(message: string): never {
  const body: ErrorResponseBody = { code: 'VALIDATION_ERROR', message };
  throw new UnprocessableEntityException(body);
}

/**
 * The room category catalog, cached in memory and refreshed from Firestore every minute so every
 * API instance picks up admin changes.
 */
@Injectable()
export class RoomCategoriesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomCategoriesService.name);
  private current: CategoryCatalog = DEFAULT_CATALOG;
  private updatedAt: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore | null) {}

  async onModuleInit(): Promise<void> {
    await this.load();
    this.refreshTimer = setInterval(() => void this.load(), REFRESH_MS);
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  private async load(): Promise<void> {
    if (!this.firestore) return;
    try {
      const snap = await this.firestore.collection(FirestoreCollections.appConfig).doc(CATALOG_DOC).get();
      const data = snap.data();
      if (!data) return;
      const parsed = CatalogSchema.safeParse({ groups: data.groups, types: data.types });
      if (!parsed.success) {
        this.logger.warn('Saved room categories are invalid; keeping the previous catalog.');
        return;
      }
      this.current = parsed.data;
      this.updatedAt = data.updatedAt?.toDate?.().toISOString() ?? null;
    } catch (error) {
      this.logger.warn(`Loading room categories failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Every group and type, hidden ones included (they label older rooms and rides). */
  catalog(): CategoryCatalog & { updatedAt: string | null } {
    return { ...this.current, updatedAt: this.updatedAt };
  }

  /** Types riders can pick: active, in an active group. */
  activeIds(): Vibe[] {
    const groups = new Set(this.current.groups.filter((g) => g.active).map((g) => g.id));
    return this.current.types.filter((t) => t.active && groups.has(t.groupId)).map((t) => t.id);
  }

  /** Every type id, for scanning live rooms (a type may be hidden while rooms still use it). */
  allIds(): Vibe[] {
    return this.current.types.map((t) => t.id);
  }

  /** A stored vibe as a catalog id; the old moods map to their closest room type. */
  resolve(value: string): Vibe;
  resolve(value: string | null | undefined): Vibe | null;
  resolve(value: string | null | undefined): Vibe | null {
    if (!value) return null;
    if (this.current.types.some((t) => t.id === value)) return value;
    return LEGACY_VIBES[value] ?? value;
  }

  /** Fallback for a room whose stored type is missing. */
  defaultId(): Vibe {
    return this.activeIds()[0] ?? this.current.types[0]!.id;
  }

  /** Hosting, joining and mood shifts are only allowed into visible room types. */
  requireActive(vibe: Vibe): void {
    if (!this.activeIds().includes(vibe)) invalid('That room type is not available right now.');
  }

  async save(input: unknown, adminEmail: string | null): Promise<ReturnType<RoomCategoriesService['catalog']>> {
    const parsed = CatalogSchema.safeParse(input);
    if (!parsed.success) {
      invalid(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' '));
    }
    const problems = catalogProblems(parsed.data, this.current);
    if (problems.length > 0) invalid(problems.join(' '));

    const now = Timestamp.now();
    await requireFirestore(this.firestore)
      .collection(FirestoreCollections.appConfig)
      .doc(CATALOG_DOC)
      .set({ ...parsed.data, updatedAt: now, updatedBy: adminEmail });
    this.current = parsed.data;
    this.updatedAt = now.toDate().toISOString();
    this.logger.log(`Room categories changed by ${adminEmail ?? 'admin'}.`);
    return this.catalog();
  }
}
