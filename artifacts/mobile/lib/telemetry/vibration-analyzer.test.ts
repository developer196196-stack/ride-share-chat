import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyzeVibration, type MotionSample } from './vibration-analyzer';

/** 3 s of samples at `hz`, summing sine components `[freq, amplitude]` on the z axis. */
function signal(hz: number, components: [number, number][], noise = 0): MotionSample[] {
  const samples: MotionSample[] = [];
  const n = Math.round(hz * 3);
  for (let i = 0; i < n; i++) {
    const t = (i / hz) * 1000;
    let z = 0;
    for (const [f, a] of components) z += a * Math.sin(2 * Math.PI * f * (t / 1000));
    z += noise * (Math.random() - 0.5);
    // Offset so magnitude stays positive (|z| would fold the wave).
    samples.push({ x: 0, y: 0, z: 5 + z, t });
  }
  return samples;
}

describe('vibration analyzer', () => {
  it('detects vehicle-band vibration (engine idle ~15 Hz)', () => {
    const f = analyzeVibration(signal(100, [[15, 0.3]], 0.02))!;
    assert.ok(f.vehicleBandRatio > 0.6, `ratio ${f.vehicleBandRatio}`);
    assert.ok(f.dominantHz > 12 && f.dominantHz < 18, `dominant ${f.dominantHz}`);
    assert.ok(f.walkingScore < 0.1);
  });

  it('flags a walking cadence (~2 Hz, strong)', () => {
    const f = analyzeVibration(signal(100, [[2, 2.5]]))!;
    assert.ok(f.walkingScore > 0.6, `walking ${f.walkingScore}`);
    assert.ok(f.vehicleBandRatio < 0.1);
  });

  it('flags hand shaking (~5 Hz, very strong)', () => {
    const f = analyzeVibration(signal(100, [[5, 14]]))!;
    assert.ok(f.shakeScore > 0.6, `shake ${f.shakeScore}`);
  });

  it('reports no vehicle signal for a phone lying still', () => {
    const f = analyzeVibration(signal(100, [], 0.005))!;
    assert.equal(f.vehicleBandRatio, 0);
  });

  it('cannot see the 10–25 Hz band when sampling too slowly', () => {
    const f = analyzeVibration(signal(15, [[15, 0.3]]).concat(signal(15, [[15, 0.3]]).map((s) => ({ ...s, t: s.t + 3000 }))));
    assert.ok(f === null || f.vehicleBandRatio === 0);
  });

  it('needs enough samples', () => {
    assert.equal(analyzeVibration(signal(10, [[1, 1]])), null);
  });
});
