import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { v3 } from '@google-cloud/translate';
import { isFirebaseConfigured } from '@workspace/firebase';
import { REDIS } from '../redis/redis.module';

export type TranslationResult = { text: string; detectedLanguage: string | null };

const CACHE_TTL_SEC = 24 * 60 * 60;

/**
 * Google Cloud Translation (v3), authenticated with the API's Firebase service account
 * (needs the "Cloud Translation API User" role). Results are cached for a day.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly client: InstanceType<typeof v3.TranslationServiceClient> | null;
  private readonly parent: string | null;
  private warnedFailure = false;

  constructor(@Inject(REDIS) private readonly redis: Redis | null) {
    if (isFirebaseConfigured()) {
      const projectId = process.env.FIREBASE_PROJECT_ID!.trim();
      this.client = new v3.TranslationServiceClient({
        projectId,
        credentials: {
          client_email: process.env.FIREBASE_CLIENT_EMAIL!.trim(),
          private_key: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        },
      });
      this.parent = `projects/${projectId}/locations/global`;
    } else {
      this.client = null;
      this.parent = null;
    }
  }

  get configured(): boolean {
    return this.client != null;
  }

  /** Returns null on failure so chat still delivers the original text. */
  async translate(text: string, targetLanguage: string): Promise<TranslationResult | null> {
    if (!this.client || !this.parent) return null;
    const cacheKey = `tr:${targetLanguage}:${createHash('sha1').update(text).digest('hex')}`;
    const cached = await this.redis?.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as TranslationResult;

    try {
      const [response] = await this.client.translateText({
        parent: this.parent,
        contents: [text],
        mimeType: 'text/plain',
        targetLanguageCode: targetLanguage,
      });
      const first = response.translations?.[0];
      if (!first?.translatedText) return null;
      const result: TranslationResult = {
        text: first.translatedText,
        detectedLanguage: first.detectedLanguageCode ?? null,
      };
      await this.redis?.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SEC).catch(() => undefined);
      return result;
    } catch (error) {
      if (!this.warnedFailure) {
        this.warnedFailure = true;
        this.logger.warn(
          `Translation failed (is the Cloud Translation API enabled and the role granted?): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    }
  }
}
