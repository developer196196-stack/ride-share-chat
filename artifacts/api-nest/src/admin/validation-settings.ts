import { ROOM_SKIP_BLOCK_DEFAULT_SEC, VALIDATION_DEFAULTS } from '../validation/validation.config';

export type ValidationSettingKind = 'number' | 'boolean';

export type ValidationSettingMeta = {
  key: string;
  group: 'Speed' | 'Timing' | 'Score' | 'Vibration' | 'Ground truth' | 'Anti-spoofing' | 'Rooms' | 'Advanced scoring';
  label: string;
  help: string;
  kind: ValidationSettingKind;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean;
};

const d = VALIDATION_DEFAULTS;

/**
 * Every Trip Validation threshold (and the Instant Escape block). These are managed ONLY from the
 * admin panel; keys and bounds match `buildValidationConfig` (out-of-range values are rejected).
 */
export const VALIDATION_SETTINGS: ValidationSettingMeta[] = [
  { key: 'VALIDATION_ENTRY_MPH', group: 'Speed', label: 'Speed to verify', help: 'A ride verifies above this speed.', kind: 'number', unit: 'mph', min: 0, max: 200, step: 1, default: d.entryMph },
  { key: 'VALIDATION_ENTRY_SUSTAIN_SEC', group: 'Speed', label: '…held for', help: 'How long the speed must be held to verify.', kind: 'number', unit: 's', min: 0, max: 600, step: 1, default: d.entrySustainSec },
  { key: 'VALIDATION_GRACE_MPH', group: 'Speed', label: 'Stopped below', help: 'Below this speed the vehicle counts as stopped (never above the speed to verify).', kind: 'number', unit: 'mph', min: 0, max: 200, step: 1, default: d.graceMph },
  { key: 'VALIDATION_GRACE_SUSTAIN_SEC', group: 'Timing', label: 'Stop before grace', help: 'How long the vehicle must be stopped before the traffic grace state starts.', kind: 'number', unit: 's', min: 0, max: 600, step: 1, default: d.graceSustainSec },
  { key: 'VALIDATION_GRACE_DURATION_SEC', group: 'Timing', label: 'Grace period', help: 'How long a stopped ride keeps its seat before it ends.', kind: 'number', unit: 's', min: 10, max: 3600, step: 10, default: d.graceDurationSec },
  { key: 'VALIDATION_POST_RIDE_SEC', group: 'Timing', label: 'Post-ride extension', help: 'How long the session stays live after the rider leaves the vehicle (0 = end at once).', kind: 'number', unit: 's', min: 0, max: 3600, step: 10, default: d.postRideSec },
  { key: 'VALIDATION_WALKING_SUSTAIN_SEC', group: 'Timing', label: 'Walking = left the vehicle', help: 'Walking this long means the rider got out.', kind: 'number', unit: 's', min: 1, max: 600, step: 1, default: d.walkingSustainSec },
  { key: 'VALIDATION_SIGNAL_LOST_SEC', group: 'Timing', label: 'Signal lost after', help: 'No data from the phone this long moves a verified ride into grace.', kind: 'number', unit: 's', min: 5, max: 3600, step: 5, default: d.signalLostSec },
  { key: 'VALIDATION_VERIFIED_SCORE', group: 'Score', label: 'Score to verify', help: 'Minimum score (0–100) to become verified.', kind: 'number', min: 0, max: 100, step: 1, default: d.verifiedScore },
  { key: 'VALIDATION_GRACE_SCORE', group: 'Score', label: 'Score to stay in a moving ride', help: 'A verified, moving ride stays verified at or above this score.', kind: 'number', min: 0, max: 100, step: 1, default: d.graceScore },
  { key: 'VALIDATION_WEIGHT_GPS', group: 'Score', label: 'Weight: GPS', help: 'Weights are normalised to add up to 1.', kind: 'number', min: 0, max: 1, step: 0.05, default: d.weightGps },
  { key: 'VALIDATION_WEIGHT_VIBRATION', group: 'Score', label: 'Weight: vibration', help: 'Weights are normalised to add up to 1.', kind: 'number', min: 0, max: 1, step: 0.05, default: d.weightVibration },
  { key: 'VALIDATION_WEIGHT_GROUND_TRUTH', group: 'Score', label: 'Weight: ground truth', help: 'OS in-vehicle detection + Google Roads.', kind: 'number', min: 0, max: 1, step: 0.05, default: d.weightGroundTruth },
  { key: 'VALIDATION_VIBRATION_BAND_FLOOR', group: 'Vibration', label: 'Vibration floor', help: 'Share of 10–25 Hz energy that scores 0. Lower it if real rides score too low on vibration.', kind: 'number', min: 0, max: 1, step: 0.01, default: d.vibrationBandFloor },
  { key: 'VALIDATION_VIBRATION_BAND_CEIL', group: 'Vibration', label: 'Vibration ceiling', help: 'Share of 10–25 Hz energy that scores 100.', kind: 'number', min: 0, max: 1, step: 0.01, default: d.vibrationBandCeil },
  { key: 'VALIDATION_MAX_GPS_ACCURACY_M', group: 'Speed', label: 'Ignore GPS worse than', help: 'GPS fixes less accurate than this are ignored for speed.', kind: 'number', unit: 'm', min: 1, max: 10000, step: 5, default: d.maxGpsAccuracyM },
  { key: 'VALIDATION_WALKING_REJECT_ABOVE', group: 'Vibration', label: 'Walking cadence rejected above', help: 'Vibration that looks this much like walking (0–1) scores 0 and counts as walking.', kind: 'number', min: 0, max: 1, step: 0.05, default: d.walkingRejectAbove },
  { key: 'VALIDATION_SHAKE_REJECT_ABOVE', group: 'Vibration', label: 'Hand shaking rejected above', help: 'Vibration that looks this much like deliberate shaking (0–1) scores 0.', kind: 'number', min: 0, max: 1, step: 0.05, default: d.shakeRejectAbove },
  { key: 'VALIDATION_ACTIVITY_MIN_CONFIDENCE', group: 'Ground truth', label: 'In-vehicle detection: minimum confidence', help: "The phone's activity reading (in vehicle, walking, still) is ignored below this confidence (0–100).", kind: 'number', min: 0, max: 100, step: 5, default: d.activityMinConfidence },
  { key: 'VALIDATION_ACTIVITY_STILL_SCORE', group: 'Ground truth', label: 'Points for "still"', help: 'Ground-truth points when the phone reports "still" (a stopped car often does).', kind: 'number', min: 0, max: 100, step: 5, default: d.activityStillScore },
  { key: 'VALIDATION_ROADS_RECHECK_SEC', group: 'Ground truth', label: 'Road check every', help: 'How often Google Roads re-checks that the rider is on a drivable road.', kind: 'number', unit: 's', min: 10, max: 3600, step: 10, default: d.roadsRecheckSec },
  { key: 'VALIDATION_ROADS_MIN_FIXES', group: 'Ground truth', label: 'Road check: minimum GPS points', help: 'GPS points needed before a road check runs.', kind: 'number', min: 1, max: 100, step: 1, default: d.roadsMinFixes },
  { key: 'VALIDATION_ROADS_MAX_FIXES', group: 'Ground truth', label: 'Road check: GPS points sent', help: 'Most recent GPS points sent to Google Roads per check.', kind: 'number', min: 1, max: 100, step: 1, default: d.roadsMaxFixes },
  { key: 'VALIDATION_ROADS_MATCHED_RATIO_MIN', group: 'Ground truth', label: 'Road check: share on a road', help: 'Share of GPS points (0–1) that must snap to a road.', kind: 'number', min: 0, max: 1, step: 0.05, default: d.roadsMatchedRatioMin },
  { key: 'VALIDATION_ROADS_MEAN_OFFSET_MAX_M', group: 'Ground truth', label: 'Road check: max distance from road', help: 'Average distance from the snapped road allowed.', kind: 'number', unit: 'm', min: 1, max: 1000, step: 1, default: d.roadsMeanOffsetMaxM },
  { key: 'VALIDATION_SPOOF_CHECKS', group: 'Anti-spoofing', label: 'Spoof checks', help: 'Mock GPS, teleporting, emulators and speed without any vehicle signal. Keep on in production.', kind: 'boolean', default: d.spoofChecks },
  { key: 'VALIDATION_TELEPORT_MPS', group: 'Anti-spoofing', label: '"Teleporting" above', help: 'Implied speed between two GPS points above this is treated as fake GPS (72 m/s ≈ 160 mph).', kind: 'number', unit: 'm/s', min: 1, max: 1000, step: 1, default: d.teleportMps },
  { key: 'VALIDATION_SUSPICION_SUSTAIN_SEC', group: 'Anti-spoofing', label: 'Suspicious after', help: 'Moving fast with no vehicle vibration and no in-vehicle reading this long is suspicious.', kind: 'number', unit: 's', min: 1, max: 600, step: 1, default: d.suspicionSustainSec },
  { key: 'VALIDATION_SUSPICION_PENALTY', group: 'Anti-spoofing', label: 'Suspicion penalty', help: 'Score points removed while suspicious.', kind: 'number', min: 0, max: 100, step: 1, default: d.suspicionPenalty },
  { key: 'VALIDATION_NEUTRAL_MODULE_SCORE', group: 'Advanced scoring', label: 'Score for a module with no data', help: 'Used when a sensor has no reading (keeps GPS alone from verifying).', kind: 'number', min: 0, max: 100, step: 1, default: d.neutralModuleScore },
  { key: 'VALIDATION_LOW_SCORE_SUSTAIN_SEC', group: 'Advanced scoring', label: 'Low score before grace', help: 'A score below the verify score for this long (while not clearly moving) starts grace.', kind: 'number', unit: 's', min: 0, max: 600, step: 1, default: d.lowScoreSustainSec },
  { key: 'VALIDATION_SCORE_SMOOTHING', group: 'Advanced scoring', label: 'Score smoothing', help: 'Weight of the newest reading (0.01–1). Lower = steadier but slower score.', kind: 'number', min: 0.01, max: 1, step: 0.05, default: d.scoreSmoothing },
  { key: 'ROOM_SKIP_BLOCK_SEC', group: 'Rooms', label: '"Next" keeps riders apart for', help: 'After a rider taps Next, they are not matched with that room\'s riders again for this long. Use a small value when testing with two devices.', kind: 'number', unit: 's', min: 0, max: 86400, step: 60, default: ROOM_SKIP_BLOCK_DEFAULT_SEC },
];

export const VALIDATION_SETTING_KEYS = new Set(VALIDATION_SETTINGS.map((s) => s.key));

/** Checks one value against its bounds; returns an error message or null. */
export function validateSetting(key: string, value: unknown): string | null {
  const meta = VALIDATION_SETTINGS.find((s) => s.key === key);
  if (!meta) return `${key} is not an editable setting.`;
  if (meta.kind === 'boolean') return typeof value === 'boolean' ? null : `${meta.label} must be on or off.`;
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${meta.label} must be a number.`;
  if (meta.min != null && value < meta.min) return `${meta.label} must be at least ${meta.min}.`;
  if (meta.max != null && value > meta.max) return `${meta.label} must be at most ${meta.max}.`;
  return null;
}
