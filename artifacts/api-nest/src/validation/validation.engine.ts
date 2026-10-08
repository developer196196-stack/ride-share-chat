/**
 * Trip Validation Engine — pure scoring + state machine (no I/O).
 *
 * Three modules are scored 0–100 and combined with the configured weights:
 *   Module 1 GPS (40%) · Module 2 micro-vibration (25%) · Module 3 ground truth (35%).
 * A module with no data counts as a neutral 50, so a rider can never reach VERIFIED
 * on GPS alone. States: PENDING → VERIFIED ⇄ GRACE → TERMINATED.
 */
import { ValidationConfig as C, MPS_TO_MPH } from './validation.config';
import type {
  ActivityReading,
  EngineState,
  GpsReading,
  ModuleScores,
  RoadCheck,
  TelemetrySample,
  TerminationReason,
  ValidationSnapshot,
  ValidationState,
  VibrationReading,
} from './validation.types';

const ON_FOOT: ReadonlySet<string> = new Set(['on_foot', 'walking', 'running', 'on_bicycle']);

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function createInitialState(now: number): EngineState {
  return {
    state: 'PENDING',
    score: 0,
    modules: { gps: null, vibration: null, groundTruth: null },
    speedMps: 0,
    aboveSince: null,
    belowSince: null,
    lowScoreSince: null,
    walkingSince: null,
    lastMovingAt: null,
    graceDeadline: null,
    graceStartedAt: null,
    verifiedAt: null,
    lastFix: null,
    recentFixes: [],
    roadCheck: null,
    activityScore: null,
    suspicionSince: null,
    terminationReason: null,
    lastSampleAt: null,
    stats: { startedAt: now, distanceM: 0, movingMs: 0, graceCount: 0, graceMs: 0 },
    updatedAt: now,
  };
}

function isAccurate(fix: GpsReading): boolean {
  return fix.accuracyM > 0 && fix.accuracyM <= C.speed.maxAccuracyM;
}

/** Reported speed, or distance/time from the previous fix when the OS gives none. */
export function resolveSpeedMps(fix: GpsReading, prev: GpsReading | null): number {
  if (fix.speedMps != null && fix.speedMps >= 0) return fix.speedMps;
  if (!prev) return 0;
  const dt = (fix.timestamp - prev.timestamp) / 1000;
  return dt > 0 ? haversineM(prev, fix) / dt : 0;
}

export function scoreGps(speedMps: number): number {
  if (speedMps >= C.speed.entryMps) return 100;
  if (speedMps >= C.speed.graceMps) return 50;
  return 0;
}

export function scoreVibration(v: VibrationReading): number {
  if (v.walkingScore > C.vibration.walkingRejectAbove || v.shakeScore > C.vibration.shakeRejectAbove) {
    return 0;
  }
  const { bandRatioFloor: lo, bandRatioCeil: hi } = C.vibration;
  return Math.round(clamp(((v.vehicleBandRatio - lo) / (hi - lo)) * 100));
}

export function scoreActivity(a: ActivityReading): number | null {
  if (a.type === 'unknown' || a.confidence < C.activity.minConfidence) return null;
  if (a.type === 'in_vehicle') return clamp(a.confidence);
  if (a.type === 'still') return C.activity.stillScore;
  return ON_FOOT.has(a.type) ? 0 : null;
}

/** Module 3 = average of the available ground-truth signals (OS activity, road match). */
export function scoreGroundTruth(activity: number | null, road: RoadCheck | null): number | null {
  const parts = [activity, road ? (road.onRoad ? 100 : 0) : null].filter((v): v is number => v != null);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export function combineScore(modules: ModuleScores): number {
  const w = C.weights;
  return clamp(
    (modules.gps ?? C.neutralModuleScore) * w.gps +
      (modules.vibration ?? C.neutralModuleScore) * w.vibration +
      (modules.groundTruth ?? C.neutralModuleScore) * w.groundTruth,
  );
}

export function bandFor(score: number): ValidationState {
  if (score >= C.bands.verified) return 'VERIFIED';
  if (score >= C.bands.grace) return 'GRACE';
  return 'TERMINATED';
}

export type ReduceResult = {
  next: EngineState;
  stateChanged: boolean;
  previousState: ValidationState;
};

function terminate(state: EngineState, reason: TerminationReason, now: number): EngineState {
  return {
    ...state,
    state: 'TERMINATED',
    terminationReason: reason,
    graceDeadline: null,
    stats:
      state.state === 'GRACE' && state.graceStartedAt
        ? { ...state.stats, graceMs: state.stats.graceMs + (now - state.graceStartedAt) }
        : state.stats,
    graceStartedAt: null,
  };
}

/**
 * Applies one telemetry sample. `now` is server time. Modules missing from the sample keep
 * their previous value (clients may send vibration and GPS at different rates).
 */
export function reduceSample(
  prev: EngineState,
  sample: TelemetrySample,
  now: number,
  opts: { allowSimulated: boolean } = { allowSimulated: false },
): ReduceResult {
  const previousState = prev.state;
  let s: EngineState = { ...prev, stats: { ...prev.stats }, lastSampleAt: now, updatedAt: now };
  // Spoof checks are skipped for allowed simulated rides, or when disabled for testing.
  const devBypass = (opts.allowSimulated && sample.simulated === true) || !C.spoof.enabled;

  // ---- Module 1: GPS ------------------------------------------------------
  let spoof = false;
  const fix = sample.gps;
  if (fix) {
    if (fix.isMock && !devBypass) spoof = true;
    const prevFix = prev.lastFix;
    if (prevFix && isAccurate(fix) && isAccurate(prevFix)) {
      const dt = (fix.timestamp - prevFix.timestamp) / 1000;
      const dist = haversineM(prevFix, fix);
      if (dt >= 1 && dist / dt > C.spoof.teleportMps && !devBypass) spoof = true;
    }

    if (isAccurate(fix)) {
      const speed = resolveSpeedMps(fix, prevFix);
      s.speedMps = speed;
      s.modules = { ...s.modules, gps: scoreGps(speed) };
      if (prevFix && speed >= C.speed.graceMps) {
        const dt = Math.max(0, fix.timestamp - prevFix.timestamp);
        s.stats.distanceM += haversineM(prevFix, fix);
        s.stats.movingMs += dt;
      }
      s.aboveSince = speed >= C.speed.entryMps ? (prev.aboveSince ?? now) : null;
      s.belowSince = speed < C.speed.graceMps ? (prev.belowSince ?? now) : null;
      if (speed >= C.speed.graceMps) s.lastMovingAt = now;
    }
    s.lastFix = fix;
    s.recentFixes = [...prev.recentFixes, fix].slice(-C.roads.maxFixes);
  }
  if (sample.device?.isEmulator && !devBypass) spoof = true;

  // ---- Module 2: vibration ------------------------------------------------
  if (sample.vibration) {
    s.modules = { ...s.modules, vibration: scoreVibration(sample.vibration) };
  }

  // ---- Module 3: ground truth ---------------------------------------------
  if (sample.activity) s.activityScore = scoreActivity(sample.activity);
  s.modules = { ...s.modules, groundTruth: scoreGroundTruth(s.activityScore, s.roadCheck) };

  // ---- Exit detection -----------------------------------------------------
  const walking =
    (sample.vibration && sample.vibration.walkingScore > C.vibration.walkingRejectAbove) ||
    (sample.activity &&
      ON_FOOT.has(sample.activity.type) &&
      sample.activity.confidence >= C.activity.minConfidence);
  s.walkingSince = walking ? (prev.walkingSince ?? now) : null;

  // ---- Suspicion: fast but no vehicle signal at all -----------------------
  const noVehicleSignal =
    s.speedMps >= C.speed.entryMps &&
    s.modules.vibration != null &&
    s.modules.vibration < 15 &&
    !(sample.activity?.type === 'in_vehicle');
  s.suspicionSince = noVehicleSignal && !devBypass ? (prev.suspicionSince ?? now) : null;

  // ---- Score --------------------------------------------------------------
  let raw = combineScore(s.modules);
  if (s.suspicionSince && now - s.suspicionSince >= C.spoof.suspicionSustainMs) {
    raw = clamp(raw - C.spoof.suspicionPenalty);
  }
  s.score = Math.round(prev.score * (1 - C.scoreSmoothing) + raw * C.scoreSmoothing);
  s.lowScoreSince = s.score < C.bands.verified ? (prev.lowScoreSince ?? now) : null;

  // ---- State machine ------------------------------------------------------
  if (s.state !== 'TERMINATED') {
    const sustainedEntry = s.aboveSince != null && now - s.aboveSince >= C.speed.entrySustainMs;
    const sustainedStop = s.belowSince != null && now - s.belowSince >= C.speed.graceSustainMs;
    const sustainedLowScore = s.lowScoreSince != null && now - s.lowScoreSince >= C.lowScoreSustainMs;
    const exited = s.walkingSince != null && now - s.walkingSince >= C.walkingSustainMs;

    if (spoof) {
      s = terminate(s, 'spoof_detected', now);
    } else if (exited && (s.state === 'VERIFIED' || s.state === 'GRACE')) {
      s = terminate(s, 'exited_vehicle', now);
    } else if (s.state === 'PENDING') {
      if (sustainedEntry && s.score >= C.bands.verified) {
        s.state = 'VERIFIED';
        s.verifiedAt = now;
        s.stats = { startedAt: now, distanceM: 0, movingMs: 0, graceCount: 0, graceMs: 0 };
      }
    } else if (s.state === 'VERIFIED') {
      if (sustainedStop || sustainedLowScore) {
        s.state = 'GRACE';
        s.graceStartedAt = now;
        s.graceDeadline = now + C.graceDurationMs;
        s.stats.graceCount += 1;
      }
    } else if (s.state === 'GRACE') {
      if (sustainedEntry && s.score >= C.bands.verified) {
        s.state = 'VERIFIED';
        s.stats.graceMs += now - (s.graceStartedAt ?? now);
        s.graceDeadline = null;
        s.graceStartedAt = null;
      } else if (s.graceDeadline != null && now >= s.graceDeadline) {
        s = terminate(s, 'grace_expired', now);
      }
    }
  }

  return { next: s, stateChanged: s.state !== previousState, previousState };
}

/** Time-based transitions for riders who stopped sending telemetry. */
export function sweepState(prev: EngineState, now: number): ReduceResult {
  const previousState = prev.state;
  let s = prev;
  if (prev.state === 'GRACE' && prev.graceDeadline != null && now >= prev.graceDeadline) {
    s = terminate({ ...prev, updatedAt: now }, 'grace_expired', now);
  } else if (
    prev.state === 'VERIFIED' &&
    prev.lastSampleAt != null &&
    now - prev.lastSampleAt >= C.signalLostMs
  ) {
    s = {
      ...prev,
      state: 'GRACE',
      graceStartedAt: now,
      graceDeadline: now + C.graceDurationMs,
      stats: { ...prev.stats, graceCount: prev.stats.graceCount + 1 },
      updatedAt: now,
    };
  }
  return { next: s, stateChanged: s.state !== previousState, previousState };
}

/** Applies a completed road-matching result and re-scores Module 3. */
export function applyRoadCheck(prev: EngineState, road: RoadCheck): EngineState {
  return {
    ...prev,
    roadCheck: road,
    modules: { ...prev.modules, groundTruth: scoreGroundTruth(prev.activityScore, road) },
  };
}

export function needsRoadCheck(state: EngineState, now: number): boolean {
  if (state.state === 'TERMINATED') return false;
  if (state.state === 'PENDING' && state.aboveSince == null) return false;
  const accurate = state.recentFixes.filter(isAccurate);
  if (accurate.length < C.roads.minFixes) return false;
  return !state.roadCheck || now - state.roadCheck.checkedAt >= C.roads.recheckMs;
}

export function toSnapshot(s: EngineState, now: number): ValidationSnapshot {
  const remaining = s.graceDeadline != null ? Math.max(0, Math.ceil((s.graceDeadline - now) / 1000)) : null;
  return {
    state: s.state,
    score: s.score,
    speedMph: Math.round(s.speedMps * MPS_TO_MPH * 10) / 10,
    modules: s.modules,
    checks: {
      gpsSpeedLock: s.speedMps >= C.speed.entryMps,
      vibration: s.modules.vibration == null ? null : s.modules.vibration >= 50,
      groundTruth: s.modules.groundTruth == null ? null : s.modules.groundTruth >= 50,
      onRoad: s.roadCheck ? s.roadCheck.onRoad : null,
    },
    graceDeadline: s.graceDeadline != null ? new Date(s.graceDeadline).toISOString() : null,
    graceRemainingSec: remaining,
    terminationReason: s.terminationReason,
    thresholds: {
      entryMph: C.speed.entryMph,
      entrySustainSec: Math.round(C.speed.entrySustainMs / 1000),
      graceMph: C.speed.graceMph,
      graceDurationSec: Math.round(C.graceDurationMs / 1000),
      verifiedScore: C.bands.verified,
    },
    updatedAt: new Date(s.updatedAt).toISOString(),
  };
}
