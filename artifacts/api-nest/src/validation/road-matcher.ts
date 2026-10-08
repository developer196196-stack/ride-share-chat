import { Injectable, Logger } from '@nestjs/common';
import { loadAppConfig } from '../config/configuration';
import { ValidationConfig as C } from './validation.config';
import { haversineM } from './validation.engine';
import type { GpsReading, RoadCheck } from './validation.types';

type SnapToRoadsResponse = {
  snappedPoints?: { location: { latitude: number; longitude: number }; originalIndex?: number }[];
  error?: { message?: string };
};

/**
 * Module 3 road matching via Google Roads API (Snap to Roads). Server-side only; results are
 * used immediately for scoring and never stored or displayed (Google Maps Platform terms).
 * Kept behind this class so a self-hosted OSRM matcher can replace it later.
 */
@Injectable()
export class RoadMatcher {
  private readonly logger = new Logger(RoadMatcher.name);
  private readonly apiKey = loadAppConfig().GOOGLE_ROADS_API_KEY;

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Returns null when not configured or the request fails (the module then counts as "no data"). */
  async check(fixes: GpsReading[], now: number): Promise<RoadCheck | null> {
    if (!this.apiKey) return null;
    const points = fixes.filter((f) => f.accuracyM > 0 && f.accuracyM <= C.speed.maxAccuracyM).slice(-C.roads.maxFixes);
    if (points.length < C.roads.minFixes) return null;

    const path = points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
    const url = `https://roads.googleapis.com/v1/snapToRoads?interpolate=false&path=${encodeURIComponent(path)}&key=${this.apiKey}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      const body = (await res.json()) as SnapToRoadsResponse;
      if (!res.ok) {
        this.logger.warn(`Roads API HTTP ${res.status}: ${body.error?.message ?? 'unknown error'}`);
        return null;
      }

      const offsets = new Map<number, number>();
      for (const snapped of body.snappedPoints ?? []) {
        if (snapped.originalIndex == null) continue;
        const original = points[snapped.originalIndex];
        if (!original) continue;
        const offset = haversineM(original, {
          lat: snapped.location.latitude,
          lng: snapped.location.longitude,
        });
        offsets.set(snapped.originalIndex, Math.min(offsets.get(snapped.originalIndex) ?? Infinity, offset));
      }

      const matchedRatio = offsets.size / points.length;
      const meanOffsetM =
        offsets.size > 0 ? [...offsets.values()].reduce((a, b) => a + b, 0) / offsets.size : Infinity;
      const onRoad = matchedRatio >= C.roads.matchedRatioMin && meanOffsetM <= C.roads.meanOffsetMaxM;

      return {
        checkedAt: now,
        onRoad,
        matchedRatio: Math.round(matchedRatio * 100) / 100,
        meanOffsetM: Number.isFinite(meanOffsetM) ? Math.round(meanOffsetM) : 9999,
      };
    } catch (error) {
      this.logger.warn(`Roads API request failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
