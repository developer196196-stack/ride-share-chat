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
import { z } from 'zod';
import { FirestoreCollections } from '@workspace/firebase';
import type { ErrorResponseBody } from '../common/error-response';
import { requireFirestore } from '../common/require-firestore';
import { FIRESTORE } from '../firebase/firebase.tokens';

/**
 * Testing overrides for Trip Validation (admin: Trip Validation & Modes).
 *
 * - desktop: the trip counts as verified without real movement (demos, emulators, app reviewers).
 * - system: the phone's own in-vehicle reading is ignored; GPS and vibration still decide.
 *
 * Each applies to nobody, everyone, or a list of riders. Stored in `appConfig/testOverrides`,
 * cached here and refreshed every 30 s so every API instance follows admin changes.
 */
export const OVERRIDE_KINDS = ['desktop', 'system'] as const;
export type OverrideKind = (typeof OVERRIDE_KINDS)[number];

const SettingSchema = z.object({
  scope: z.enum(['off', 'all', 'riders']),
  uids: z.array(z.string().min(1).max(128)).max(200),
});
export const TestOverridesSchema = z.object({ desktop: SettingSchema, system: SettingSchema });
export type TestOverrides = z.infer<typeof TestOverridesSchema>;
export type RiderOverrides = Record<OverrideKind, boolean>;

const DOC = 'testOverrides';
const REFRESH_MS = 30_000;
export const NO_OVERRIDES: TestOverrides = {
  desktop: { scope: 'off', uids: [] },
  system: { scope: 'off', uids: [] },
};

/** Which overrides apply to one rider. */
export function overridesFor(settings: TestOverrides, uid: string): RiderOverrides {
  const on = (s: TestOverrides[OverrideKind]) => s.scope === 'all' || (s.scope === 'riders' && s.uids.includes(uid));
  return { desktop: on(settings.desktop), system: on(settings.system) };
}

@Injectable()
export class TestOverridesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TestOverridesService.name);
  private current: TestOverrides = NO_OVERRIDES;
  private updatedAt: string | null = null;
  private updatedBy: string | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore | null) {}

  async onModuleInit(): Promise<void> {
    await this.load();
    this.timer = setInterval(() => void this.load(), REFRESH_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async load(): Promise<void> {
    if (!this.firestore) return;
    try {
      const data = (await this.firestore.collection(FirestoreCollections.appConfig).doc(DOC).get()).data();
      if (!data) return;
      const parsed = TestOverridesSchema.safeParse({ desktop: data.desktop, system: data.system });
      if (!parsed.success) return void this.logger.warn('Saved testing overrides are invalid; keeping the previous ones.');
      const before = JSON.stringify(this.current);
      this.current = parsed.data;
      this.updatedAt = data.updatedAt?.toDate?.().toISOString() ?? null;
      this.updatedBy = data.updatedBy ?? null;
      if (before !== JSON.stringify(this.current)) this.warnIfGlobal();
    } catch (error) {
      this.logger.warn(`Loading testing overrides failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private warnIfGlobal(): void {
    const global = OVERRIDE_KINDS.filter((k) => this.current[k].scope === 'all');
    if (global.length > 0) {
      this.logger.warn(`Testing override on for ALL riders: ${global.join(', ')}. Turn it off before launch.`);
    }
  }

  get(): TestOverrides & { updatedAt: string | null; updatedBy: string | null } {
    return { ...this.current, updatedAt: this.updatedAt, updatedBy: this.updatedBy };
  }

  forRider(uid: string): RiderOverrides {
    return overridesFor(this.current, uid);
  }

  async save(input: unknown, adminEmail: string | null) {
    const parsed = TestOverridesSchema.safeParse(input);
    if (!parsed.success) {
      const body: ErrorResponseBody = {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' '),
      };
      throw new UnprocessableEntityException(body);
    }
    // Keep lists tidy: no duplicates.
    const next: TestOverrides = {
      desktop: { ...parsed.data.desktop, uids: [...new Set(parsed.data.desktop.uids)] },
      system: { ...parsed.data.system, uids: [...new Set(parsed.data.system.uids)] },
    };
    const now = Timestamp.now();
    await requireFirestore(this.firestore)
      .collection(FirestoreCollections.appConfig)
      .doc(DOC)
      .set({ ...next, updatedAt: now, updatedBy: adminEmail });
    this.current = next;
    this.updatedAt = now.toDate().toISOString();
    this.updatedBy = adminEmail;
    this.logger.log(`Testing overrides changed by ${adminEmail ?? 'admin'}: desktop=${next.desktop.scope}, system=${next.system.scope}`);
    this.warnIfGlobal();
    return this.get();
  }

  /** Rider page switch: add or remove one rider (switches the override to "selected riders" if it was off). */
  async setForRider(uid: string, kind: OverrideKind, on: boolean, adminEmail: string | null) {
    const setting = this.current[kind];
    const uids = on ? [...new Set([...setting.uids, uid])] : setting.uids.filter((u) => u !== uid);
    const scope = setting.scope === 'all' ? 'all' : uids.length > 0 ? 'riders' : setting.scope === 'riders' ? 'riders' : 'off';
    return this.save({ ...this.current, [kind]: { scope, uids } }, adminEmail);
  }
}
