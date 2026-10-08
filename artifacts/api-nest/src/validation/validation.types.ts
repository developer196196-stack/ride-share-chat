/** Trip Validation Engine data types. Keep in sync with OpenAPI `Telemetry*` / `ValidationSnapshot`. */

export type ValidationState = 'PENDING' | 'VERIFIED' | 'GRACE' | 'TERMINATED';

export type ActivityType =
  | 'in_vehicle'
  | 'on_bicycle'
  | 'on_foot'
  | 'walking'
  | 'running'
  | 'still'
  | 'unknown';

/** Module 1 — one GPS fix. */
export type GpsReading = {
  lat: number;
  lng: number;
  /** Reported speed in m/s; null/negative when the OS has none. */
  speedMps: number | null;
  accuracyM: number;
  /** Fix time from the device (ms since epoch). */
  timestamp: number;
  isMock: boolean;
};

/** Module 2 — summary of a 3-second FFT window computed on the phone. */
export type VibrationReading = {
  /** Share of spectral energy in the 10–25 Hz vehicle band (0–1). */
  vehicleBandRatio: number;
  dominantHz: number;
  rmsMps2: number;
  /** 0–1 likelihood of a walking/running cadence (≈1.5–3 Hz). */
  walkingScore: number;
  /** 0–1 likelihood of deliberate hand shaking. */
  shakeScore: number;
  sampleRateHz: number;
};

/** Module 3 — OS activity recognition (Android IN_VEHICLE / iOS automotive). */
export type ActivityReading = {
  type: ActivityType;
  /** 0–100. */
  confidence: number;
};

export type TelemetrySample = {
  gps?: GpsReading;
  vibration?: VibrationReading;
  activity?: ActivityReading;
  device?: { isEmulator?: boolean; isRooted?: boolean };
  /** Dev-only simulated ride; rejected unless VALIDATION_ALLOW_SIMULATED is on. */
  simulated?: boolean;
  preferredLanguage?: string;
};

export type ModuleScores = {
  /** 0–100 or null when the module has no data. */
  gps: number | null;
  vibration: number | null;
  groundTruth: number | null;
};

export type RoadCheck = {
  checkedAt: number;
  onRoad: boolean;
  meanOffsetM: number;
  matchedRatio: number;
};

export type TerminationReason =
  | 'spoof_detected'
  | 'exited_vehicle'
  | 'grace_expired'
  | 'signal_lost'
  | 'user_ended';

/** Persisted per-rider engine state (Redis). */
export type EngineState = {
  state: ValidationState;
  score: number;
  modules: ModuleScores;
  speedMps: number;
  /** When speed first went above the entry threshold in the current run. */
  aboveSince: number | null;
  /** When speed first fell below the grace threshold in the current run. */
  belowSince: number | null;
  /** When the score first fell below the VERIFIED band in the current run. */
  lowScoreSince: number | null;
  walkingSince: number | null;
  lastMovingAt: number | null;
  graceDeadline: number | null;
  graceStartedAt: number | null;
  verifiedAt: number | null;
  lastFix: GpsReading | null;
  recentFixes: GpsReading[];
  roadCheck: RoadCheck | null;
  /** Last OS-activity sub-score (part of Module 3), null when unknown. */
  activityScore: number | null;
  suspicionSince: number | null;
  terminationReason: TerminationReason | null;
  lastSampleAt: number | null;
  /** Session stats for the ride summary. */
  stats: {
    startedAt: number;
    distanceM: number;
    movingMs: number;
    graceCount: number;
    graceMs: number;
  };
  updatedAt: number;
};

/** What clients see (REST + VALIDATION_UPDATE). */
export type ValidationSnapshot = {
  state: ValidationState;
  score: number;
  speedMph: number;
  modules: ModuleScores;
  checks: {
    gpsSpeedLock: boolean;
    vibration: boolean | null;
    groundTruth: boolean | null;
    onRoad: boolean | null;
  };
  graceDeadline: string | null;
  graceRemainingSec: number | null;
  terminationReason: TerminationReason | null;
  /** Active thresholds (configurable via VALIDATION_* env) so the app's copy matches the server. */
  thresholds: {
    entryMph: number;
    entrySustainSec: number;
    graceMph: number;
    graceDurationSec: number;
    verifiedScore: number;
  };
  updatedAt: string;
};
