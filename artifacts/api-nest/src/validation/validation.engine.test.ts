import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { setValidationConfigForTests, ValidationConfig as C } from './validation.config';
import {
  applyRoadCheck,
  createInitialState,
  needsRoadCheck,
  reduceSample,
  sweepState,
} from './validation.engine';
import type { EngineState, TelemetrySample } from './validation.types';

const MPH = 0.44704;
const METERS_PER_DEG_LAT = 111_320;
const T0 = 1_700_000_000_000;

/** Builds a sample at `t` ms, moving north at `mph` (positions consistent with speed). */
function sample(
  t: number,
  mph: number,
  opts: {
    vib?: number | null;
    walking?: number;
    activity?: TelemetrySample['activity'];
    mock?: boolean;
    lat?: number;
  } = {},
): TelemetrySample {
  const lat = opts.lat ?? 40;
  return {
    gps: { lat, lng: -74, speedMps: mph * MPH, accuracyM: 8, timestamp: t, isMock: opts.mock ?? false },
    vibration:
      opts.vib === null
        ? undefined
        : {
            vehicleBandRatio: opts.vib ?? 0.35,
            dominantHz: 14,
            rmsMps2: 0.3,
            walkingScore: opts.walking ?? 0,
            shakeScore: 0,
            sampleRateHz: 100,
          },
    activity: opts.activity,
  };
}

/** Feeds samples every `stepMs` from `from` to `to` (inclusive). */
function drive(
  state: EngineState,
  from: number,
  to: number,
  stepMs: number,
  make: (t: number) => TelemetrySample,
): EngineState {
  let s = state;
  for (let t = from; t <= to; t += stepMs) {
    const next = make(t);
    // Advance the position from the previous fix so movement is consistent with speed.
    if (next.gps && s.lastFix) {
      const dt = (t - s.lastFix.timestamp) / 1000;
      next.gps.lat = s.lastFix.lat + ((next.gps.speedMps ?? 0) * dt) / METERS_PER_DEG_LAT;
    }
    s = reduceSample(s, next, t).next;
  }
  return s;
}

const inVehicle = { type: 'in_vehicle' as const, confidence: 90 };

function verified(): { s: EngineState; t: number } {
  const s = drive(createInitialState(T0), T0, T0 + 20_000, 2_000, (t) => sample(t, 25, { activity: inVehicle }));
  assert.equal(s.state, 'VERIFIED');
  return { s, t: T0 + 20_000 };
}

describe('Trip Validation Engine', () => {
  // Always test production defaults, whatever VALIDATION_* is set in the shell.
  beforeEach(() => setValidationConfigForTests({}));

  it('verifies a real car ride (speed + vibration + in-vehicle)', () => {
    const { s } = verified();
    assert.ok(s.score >= C.bands.verified, `score ${s.score}`);
    assert.ok(s.verifiedAt);
  });

  it('never verifies on GPS alone', () => {
    const s = drive(createInitialState(T0), T0, T0 + 60_000, 2_000, (t) => sample(t, 30, { vib: null }));
    assert.equal(s.state, 'PENDING');
    assert.ok(s.score < C.bands.verified);
  });

  it('requires speed sustained for 5 seconds', () => {
    let s = createInitialState(T0);
    // Strong signals but only above 10 mph for 4 s, then slow.
    s = drive(s, T0, T0 + 4_000, 2_000, (t) => sample(t, 25, { activity: inVehicle }));
    s = drive(s, T0 + 6_000, T0 + 10_000, 2_000, (t) => sample(t, 3, { activity: inVehicle }));
    assert.equal(s.state, 'PENDING');
  });

  it('terminates on mock location', () => {
    const s = reduceSample(createInitialState(T0), sample(T0, 25, { mock: true }), T0).next;
    assert.equal(s.state, 'TERMINATED');
    assert.equal(s.terminationReason, 'spoof_detected');
  });

  it('allows mock locations for simulated rides only when enabled', () => {
    const sim = { ...sample(T0, 25, { mock: true }), simulated: true };
    assert.equal(reduceSample(createInitialState(T0), sim, T0, { allowSimulated: true }).next.state, 'PENDING');
    assert.equal(reduceSample(createInitialState(T0), sim, T0, { allowSimulated: false }).next.state, 'TERMINATED');
  });

  it('terminates on teleporting GPS', () => {
    let s = reduceSample(createInitialState(T0), sample(T0, 20), T0).next;
    s = reduceSample(s, sample(T0 + 2_000, 20, { lat: 41 }), T0 + 2_000).next; // ~111 km in 2 s
    assert.equal(s.terminationReason, 'spoof_detected');
  });

  it('enters GRACE at a red light and recovers when moving again', () => {
    let { s, t } = verified();
    s = drive(s, t + 2_000, t + 20_000, 2_000, (tt) => sample(tt, 0, { activity: inVehicle }));
    assert.equal(s.state, 'GRACE');
    assert.ok(s.graceDeadline);
    s = drive(s, t + 22_000, t + 40_000, 2_000, (tt) => sample(tt, 25, { activity: inVehicle }));
    assert.equal(s.state, 'VERIFIED');
    assert.equal(s.graceDeadline, null);
    assert.equal(s.stats.graceCount, 1);
  });

  it('keeps an electric car (no idle vibration) in GRACE until the 5-minute timer', () => {
    let { s, t } = verified();
    const stopped = (tt: number) => sample(tt, 0, { vib: 0.02, activity: { type: 'still', confidence: 80 } });
    s = drive(s, t + 10_000, t + 4 * 60_000, 10_000, stopped);
    assert.equal(s.state, 'GRACE', 'should still be holding the seat after 4 minutes');
    s = drive(s, t + 4 * 60_000 + 10_000, t + 6 * 60_000, 10_000, stopped);
    assert.equal(s.state, 'TERMINATED');
    assert.equal(s.terminationReason, 'grace_expired');
  });

  it('terminates when the rider gets out and walks', () => {
    let { s, t } = verified();
    s = drive(s, t + 2_000, t + 30_000, 2_000, (tt) =>
      sample(tt, 3, { walking: 0.85, activity: { type: 'walking', confidence: 85 } }),
    );
    assert.equal(s.state, 'TERMINATED');
    assert.equal(s.terminationReason, 'exited_vehicle');
  });

  it('does not verify a train (fast, vibrating, but not on a road)', () => {
    let s = drive(createInitialState(T0), T0, T0 + 6_000, 2_000, (t) => sample(t, 50));
    assert.ok(needsRoadCheck(s, T0 + 6_000));
    s = applyRoadCheck(s, { checkedAt: T0 + 6_000, onRoad: false, meanOffsetM: 80, matchedRatio: 0.1 });
    s = drive(s, T0 + 8_000, T0 + 60_000, 2_000, (t) => sample(t, 50));
    assert.equal(s.state, 'PENDING');
  });

  it('moves to GRACE when telemetry stops, then terminates after the grace window', () => {
    const { s, t } = verified();
    const lost = sweepState(s, t + C.signalLostMs + 1);
    assert.equal(lost.next.state, 'GRACE');
    const expired = sweepState(lost.next, t + C.signalLostMs + C.graceDurationMs + 2);
    assert.equal(expired.next.state, 'TERMINATED');
    assert.equal(expired.next.terminationReason, 'grace_expired');
  });

  it('tracks distance for the ride summary', () => {
    const { s } = verified();
    // 25 mph for ~20 s ≈ 223 m (stats reset at verification, so expect a positive share of it).
    assert.ok(s.stats.distanceM >= 0);
    const later = drive(s, T0 + 22_000, T0 + 62_000, 2_000, (t) => sample(t, 25, { activity: inVehicle }));
    assert.ok(later.stats.distanceM > 400, `distance ${later.stats.distanceM}`);
  });

  it('desk testing: relaxed env thresholds verify a phone lying still', () => {
    setValidationConfigForTests({
      VALIDATION_ENTRY_MPH: '0',
      VALIDATION_ENTRY_SUSTAIN_SEC: '2',
      VALIDATION_GRACE_MPH: '0',
      VALIDATION_VERIFIED_SCORE: '30',
      VALIDATION_SPOOF_CHECKS: 'false',
    });
    // Stationary, no vibration, OS says "still", mock location on: all would normally fail.
    const s = drive(createInitialState(T0), T0, T0 + 12_000, 2_000, (t) =>
      sample(t, 0, { vib: 0.01, mock: true, activity: { type: 'still', confidence: 80 } }),
    );
    assert.equal(s.state, 'VERIFIED', `score ${s.score}`);
  });

  it('production defaults reject the same stationary phone', () => {
    const s = drive(createInitialState(T0), T0, T0 + 12_000, 2_000, (t) =>
      sample(t, 0, { vib: 0.01, activity: { type: 'still', confidence: 80 } }),
    );
    assert.equal(s.state, 'PENDING');
  });
});
