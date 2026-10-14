/**
 * Trip Validation Engine tuning. Defaults follow the client specification with the
 * adjustments agreed in the implementation plan (v2.1, section 4).
 *
 * Every rider-facing threshold can be overridden from the environment (VALIDATION_*), e.g.
 * to test at a desk with relaxed values. Production should use the defaults (unset) until
 * real-car field testing says otherwise. See artifacts/api-nest/env.template.
 */
const MPH_TO_MPS = 0.44704;

export const MPS_TO_MPH = 1 / MPH_TO_MPS;

/** Production defaults (also what you get when no VALIDATION_* variable is set). */
export const VALIDATION_DEFAULTS = {
  entryMph: 10,
  entrySustainSec: 5,
  graceMph: 5,
  graceSustainSec: 15,
  graceDurationSec: 300,
  postRideSec: 180,
  verifiedScore: 80,
  graceScore: 50,
  weightGps: 0.4,
  weightVibration: 0.25,
  weightGroundTruth: 0.35,
  neutralModuleScore: 50,
  maxGpsAccuracyM: 50,
  walkingSustainSec: 20,
  signalLostSec: 60,
  spoofChecks: true,
  lowScoreSustainSec: 10,
  scoreSmoothing: 0.5,
  vibrationBandFloor: 0.12,
  vibrationBandCeil: 0.4,
  walkingRejectAbove: 0.6,
  shakeRejectAbove: 0.6,
  activityMinConfidence: 50,
  activityStillScore: 40,
  roadsRecheckSec: 180,
  roadsMinFixes: 3,
  roadsMaxFixes: 20,
  roadsMatchedRatioMin: 0.6,
  roadsMeanOffsetMaxM: 25,
  teleportMps: 72,
  suspicionSustainSec: 30,
  suspicionPenalty: 25,
} as const;

type Env = Record<string, string | undefined>;

function num(env: Env, key: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    console.warn(`[validation] Ignoring invalid ${key}=${raw}; using ${fallback}.`);
    return fallback;
  }
  return value;
}

function bool(env: Env, key: string, fallback: boolean): boolean {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function buildValidationConfig(env: Env = process.env) {
  const d = VALIDATION_DEFAULTS;
  const entryMph = num(env, 'VALIDATION_ENTRY_MPH', d.entryMph, 0, 200);
  const graceMph = num(env, 'VALIDATION_GRACE_MPH', d.graceMph, 0, 200);
  const verified = num(env, 'VALIDATION_VERIFIED_SCORE', d.verifiedScore, 0, 100);
  const grace = Math.min(num(env, 'VALIDATION_GRACE_SCORE', d.graceScore, 0, 100), verified);

  const rawWeights = {
    gps: num(env, 'VALIDATION_WEIGHT_GPS', d.weightGps, 0, 1),
    vibration: num(env, 'VALIDATION_WEIGHT_VIBRATION', d.weightVibration, 0, 1),
    groundTruth: num(env, 'VALIDATION_WEIGHT_GROUND_TRUTH', d.weightGroundTruth, 0, 1),
  };
  // Weights are normalised so they always add up to 1.
  const weightSum = rawWeights.gps + rawWeights.vibration + rawWeights.groundTruth || 1;

  // The vibration ratio band maps linearly to 0–100, so the ceiling must stay above the floor.
  const vibrationFloor = num(env, 'VALIDATION_VIBRATION_BAND_FLOOR', d.vibrationBandFloor, 0, 1);
  const vibrationCeil = Math.max(num(env, 'VALIDATION_VIBRATION_BAND_CEIL', d.vibrationBandCeil, 0, 1), vibrationFloor + 0.01);

  return {
    weights: {
      gps: rawWeights.gps / weightSum,
      vibration: rawWeights.vibration / weightSum,
      groundTruth: rawWeights.groundTruth / weightSum,
    },

    bands: { verified, grace },

    /** Score used for a module that has no data (keeps GPS alone from verifying). */
    neutralModuleScore: num(env, 'VALIDATION_NEUTRAL_MODULE_SCORE', d.neutralModuleScore, 0, 100),

    /** Module 1 — GPS. */
    speed: {
      /** Enter / recover VERIFIED: above this speed … */
      entryMps: entryMph * MPH_TO_MPS,
      entryMph,
      /** … sustained this long. */
      entrySustainMs: num(env, 'VALIDATION_ENTRY_SUSTAIN_SEC', d.entrySustainSec, 0, 600) * 1000,
      /** Enter GRACE: below this speed … (never above the entry speed) */
      graceMps: Math.min(graceMph, entryMph) * MPH_TO_MPS,
      graceMph: Math.min(graceMph, entryMph),
      /** … sustained this long (red light, traffic). */
      graceSustainMs: num(env, 'VALIDATION_GRACE_SUSTAIN_SEC', d.graceSustainSec, 0, 600) * 1000,
      /** Fixes less accurate than this are ignored for speed. */
      maxAccuracyM: num(env, 'VALIDATION_MAX_GPS_ACCURACY_M', d.maxGpsAccuracyM, 1, 10_000),
    },

    /** GRACE lasts at most this long. */
    graceDurationMs: num(env, 'VALIDATION_GRACE_DURATION_SEC', d.graceDurationSec, 10, 3_600) * 1000,

    /** Post-ride extension: the session stays live this long after the rider leaves the vehicle (0 = end at once). */
    postRideMs: num(env, 'VALIDATION_POST_RIDE_SEC', d.postRideSec, 0, 3_600) * 1000,

    /** VERIFIED → GRACE when the score stays under the VERIFIED band this long (even while moving). */
    lowScoreSustainMs: num(env, 'VALIDATION_LOW_SCORE_SUSTAIN_SEC', d.lowScoreSustainSec, 0, 600) * 1000,

    /** Module 2 — vibration (vehicle band ratio mapped linearly to 0–100). */
    vibration: {
      bandRatioFloor: vibrationFloor,
      bandRatioCeil: vibrationCeil,
      walkingRejectAbove: num(env, 'VALIDATION_WALKING_REJECT_ABOVE', d.walkingRejectAbove, 0, 1),
      shakeRejectAbove: num(env, 'VALIDATION_SHAKE_REJECT_ABOVE', d.shakeRejectAbove, 0, 1),
    },

    /** Module 3 — ground truth. */
    activity: {
      minConfidence: num(env, 'VALIDATION_ACTIVITY_MIN_CONFIDENCE', d.activityMinConfidence, 0, 100),
      /** Points for "still" — a stopped car often reports still. */
      stillScore: num(env, 'VALIDATION_ACTIVITY_STILL_SCORE', d.activityStillScore, 0, 100),
    },
    roads: {
      /** Re-check road matching this often while in a session. */
      recheckMs: num(env, 'VALIDATION_ROADS_RECHECK_SEC', d.roadsRecheckSec, 10, 3_600) * 1000,
      /** Minimum fixes needed for a road check. */
      minFixes: num(env, 'VALIDATION_ROADS_MIN_FIXES', d.roadsMinFixes, 1, 100),
      maxFixes: num(env, 'VALIDATION_ROADS_MAX_FIXES', d.roadsMaxFixes, 1, 100),
      matchedRatioMin: num(env, 'VALIDATION_ROADS_MATCHED_RATIO_MIN', d.roadsMatchedRatioMin, 0, 1),
      meanOffsetMaxM: num(env, 'VALIDATION_ROADS_MEAN_OFFSET_MAX_M', d.roadsMeanOffsetMaxM, 1, 1_000),
    },

    /** Exit detection: walking cadence or on-foot activity for this long. */
    walkingSustainMs: num(env, 'VALIDATION_WALKING_SUSTAIN_SEC', d.walkingSustainSec, 1, 600) * 1000,

    /** Anti-spoofing (mock GPS, teleporting, emulators, speed without any vehicle signal). */
    spoof: {
      enabled: bool(env, 'VALIDATION_SPOOF_CHECKS', d.spoofChecks),
      /** Implied speed between consecutive accurate fixes above this is "teleporting" (~160 mph). */
      teleportMps: num(env, 'VALIDATION_TELEPORT_MPS', d.teleportMps, 1, 1_000),
      /** Moving fast with no vehicle vibration and no in-vehicle activity this long is suspicious. */
      suspicionSustainMs: num(env, 'VALIDATION_SUSPICION_SUSTAIN_SEC', d.suspicionSustainSec, 1, 600) * 1000,
      /** Score penalty while suspicious. */
      suspicionPenalty: num(env, 'VALIDATION_SUSPICION_PENALTY', d.suspicionPenalty, 0, 100),
    },

    /** No telemetry for this long while VERIFIED moves the rider into GRACE. */
    signalLostMs: num(env, 'VALIDATION_SIGNAL_LOST_SEC', d.signalLostSec, 5, 3_600) * 1000,

    /** Score smoothing (exponential moving average weight of the newest sample). */
    scoreSmoothing: num(env, 'VALIDATION_SCORE_SMOOTHING', d.scoreSmoothing, 0.01, 1),

    /** Recommended client polling. */
    polling: { preVerificationMs: 2_000, inRoomMs: 10_000 },
  };
}

export type ValidationSettings = ReturnType<typeof buildValidationConfig>;

let current: ValidationSettings | null = null;

/** Built on first use, after Nest has loaded `.env`. */
export function getValidationConfig(): ValidationSettings {
  if (!current) current = buildValidationConfig();
  return current;
}

/** Tests: rebuild from a specific environment (or defaults with `{}`). */
export function setValidationConfigForTests(env: Env): void {
  current = buildValidationConfig(env);
}

/** Lazy view so existing `ValidationConfig.x.y` reads always see the loaded config. */
export const ValidationConfig: ValidationSettings = new Proxy({} as ValidationSettings, {
  get: (_target, key) => getValidationConfig()[key as keyof ValidationSettings],
});

/** Names of VALIDATION_* overrides that differ from production defaults (for a startup warning). */
export function relaxedValidationOverrides(env: Env = process.env): string[] {
  const d = VALIDATION_DEFAULTS;
  const keys: [string, number | boolean][] = [
    ['VALIDATION_ENTRY_MPH', d.entryMph],
    ['VALIDATION_ENTRY_SUSTAIN_SEC', d.entrySustainSec],
    ['VALIDATION_GRACE_MPH', d.graceMph],
    ['VALIDATION_GRACE_SUSTAIN_SEC', d.graceSustainSec],
    ['VALIDATION_GRACE_DURATION_SEC', d.graceDurationSec],
    ['VALIDATION_POST_RIDE_SEC', d.postRideSec],
    ['VALIDATION_VERIFIED_SCORE', d.verifiedScore],
    ['VALIDATION_GRACE_SCORE', d.graceScore],
    ['VALIDATION_WEIGHT_GPS', d.weightGps],
    ['VALIDATION_WEIGHT_VIBRATION', d.weightVibration],
    ['VALIDATION_WEIGHT_GROUND_TRUTH', d.weightGroundTruth],
    ['VALIDATION_NEUTRAL_MODULE_SCORE', d.neutralModuleScore],
    ['VALIDATION_MAX_GPS_ACCURACY_M', d.maxGpsAccuracyM],
    ['VALIDATION_WALKING_SUSTAIN_SEC', d.walkingSustainSec],
    ['VALIDATION_SIGNAL_LOST_SEC', d.signalLostSec],
    ['VALIDATION_SPOOF_CHECKS', d.spoofChecks],
    ['VALIDATION_LOW_SCORE_SUSTAIN_SEC', d.lowScoreSustainSec],
    ['VALIDATION_SCORE_SMOOTHING', d.scoreSmoothing],
    ['VALIDATION_VIBRATION_BAND_FLOOR', d.vibrationBandFloor],
    ['VALIDATION_VIBRATION_BAND_CEIL', d.vibrationBandCeil],
    ['VALIDATION_WALKING_REJECT_ABOVE', d.walkingRejectAbove],
    ['VALIDATION_SHAKE_REJECT_ABOVE', d.shakeRejectAbove],
    ['VALIDATION_ACTIVITY_MIN_CONFIDENCE', d.activityMinConfidence],
    ['VALIDATION_ACTIVITY_STILL_SCORE', d.activityStillScore],
    ['VALIDATION_ROADS_RECHECK_SEC', d.roadsRecheckSec],
    ['VALIDATION_ROADS_MIN_FIXES', d.roadsMinFixes],
    ['VALIDATION_ROADS_MAX_FIXES', d.roadsMaxFixes],
    ['VALIDATION_ROADS_MATCHED_RATIO_MIN', d.roadsMatchedRatioMin],
    ['VALIDATION_ROADS_MEAN_OFFSET_MAX_M', d.roadsMeanOffsetMaxM],
    ['VALIDATION_TELEPORT_MPS', d.teleportMps],
    ['VALIDATION_SUSPICION_SUSTAIN_SEC', d.suspicionSustainSec],
    ['VALIDATION_SUSPICION_PENALTY', d.suspicionPenalty],
  ];
  return keys
    .filter(([key, def]) => {
      const raw = env[key]?.trim();
      if (!raw) return false;
      return typeof def === 'boolean' ? bool(env, key, def) !== def : Number(raw) !== def;
    })
    .map(([key]) => `${key}=${env[key]!.trim()}`);
}
