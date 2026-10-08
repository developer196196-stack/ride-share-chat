import type { ValidationSnapshot } from '@workspace/api-client-react';

export type Thresholds = ValidationSnapshot['thresholds'];

/** Production defaults, shown until the first snapshot arrives from the server. */
export const DEFAULT_THRESHOLDS: Thresholds = {
  entryMph: 10,
  entrySustainSec: 5,
  graceMph: 5,
  graceDurationSec: 300,
  verifiedScore: 80,
};

/** Thresholds come from the API (VALIDATION_* env), so the copy always matches the engine. */
export function thresholdsOf(snapshot: ValidationSnapshot | null | undefined): Thresholds {
  return snapshot?.thresholds ?? DEFAULT_THRESHOLDS;
}

/** 300 → "5-Minute", 90 → "90-Second". */
export function formatGraceDuration(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}-Minute`;
  return `${seconds}-Second`;
}
