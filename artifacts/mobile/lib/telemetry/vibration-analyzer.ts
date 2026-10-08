/**
 * Trip Validation Module 2 — on-device micro-vibration analysis.
 * Runs an FFT over the last ~3 s of linear acceleration and reports the share of energy in
 * the 10–25 Hz vehicle band, plus walking-cadence and hand-shaking likelihoods. Only these
 * summary values leave the phone.
 */
import FFT from 'fft.js';

export type MotionSample = { x: number; y: number; z: number; t: number };

export type VibrationFeatures = {
  vehicleBandRatio: number;
  dominantHz: number;
  rmsMps2: number;
  walkingScore: number;
  shakeScore: number;
  sampleRateHz: number;
};

export const VibrationConfig = {
  windowMs: 3_000,
  minSamples: 64,
  vehicleBandHz: [10, 25] as const,
  walkingBandHz: [1.2, 3.0] as const,
  shakeBandHz: [3.0, 8.0] as const,
  analysisBandHz: [0.5, 45] as const,
  /** Below this RMS the phone is effectively still — no vehicle signal. */
  noiseFloorMps2: 0.015,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function largestPowerOfTwo(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

export function analyzeVibration(samples: MotionSample[]): VibrationFeatures | null {
  if (samples.length < VibrationConfig.minSamples) return null;
  const durationSec = (samples[samples.length - 1]!.t - samples[0]!.t) / 1000;
  if (durationSec <= 0) return null;
  const sampleRateHz = (samples.length - 1) / durationSec;

  const size = largestPowerOfTwo(samples.length);
  const window = samples.slice(-size);

  // Per-axis spectra summed: orientation-independent and, unlike the vector magnitude,
  // it does not fold a zero-mean vibration into twice its frequency.
  const axes = (['x', 'y', 'z'] as const).map((axis) => {
    const values = window.map((s) => s[axis]);
    const mean = values.reduce((a, b) => a + b, 0) / size;
    return values.map((v) => v - mean);
  });
  const rmsMps2 = Math.sqrt(
    axes.reduce((sum, values) => sum + values.reduce((a, b) => a + b * b, 0), 0) / size,
  );

  const fft = new FFT(size);
  const hann = Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  const spectrum = new Float64Array(size / 2);
  for (const values of axes) {
    const out = fft.createComplexArray() as number[];
    fft.realTransform(out, values.map((v, i) => v * hann[i]!));
    for (let k = 1; k < size / 2; k++) {
      const re = out[2 * k]!;
      const im = out[2 * k + 1]!;
      spectrum[k]! += re * re + im * im;
    }
  }

  const nyquist = sampleRateHz / 2;
  const [aLo, aHi] = VibrationConfig.analysisBandHz;
  const bandEnergy = { total: 0, vehicle: 0, walking: 0, shake: 0 };
  let dominantHz = 0;
  let dominantPower = 0;
  for (let k = 1; k < size / 2; k++) {
    const freq = (k * sampleRateHz) / size;
    if (freq < aLo || freq > Math.min(aHi, nyquist)) continue;
    const power = spectrum[k]!;
    bandEnergy.total += power;
    if (freq >= VibrationConfig.vehicleBandHz[0] && freq <= VibrationConfig.vehicleBandHz[1]) bandEnergy.vehicle += power;
    if (freq >= VibrationConfig.walkingBandHz[0] && freq <= VibrationConfig.walkingBandHz[1]) bandEnergy.walking += power;
    if (freq >= VibrationConfig.shakeBandHz[0] && freq <= VibrationConfig.shakeBandHz[1]) bandEnergy.shake += power;
    if (power > dominantPower) {
      dominantPower = power;
      dominantHz = freq;
    }
  }

  const still = rmsMps2 < VibrationConfig.noiseFloorMps2 || bandEnergy.total === 0;
  const ratio = (part: number) => (still ? 0 : part / bandEnergy.total);
  const walkingRatio = ratio(bandEnergy.walking);
  const shakeRatio = ratio(bandEnergy.shake);

  return {
    // The 10–25 Hz band is only measurable when sampling above ~50 Hz.
    vehicleBandRatio: nyquist >= VibrationConfig.vehicleBandHz[0] ? round(ratio(bandEnergy.vehicle)) : 0,
    dominantHz: round(dominantHz, 1),
    rmsMps2: round(rmsMps2),
    // Walking: strong 1.2–3 Hz cadence at walking-level acceleration.
    walkingScore: round(clamp01((walkingRatio - 0.25) / 0.35) * clamp01((rmsMps2 - 0.6) / 0.8)),
    // Shaking: large acceleration concentrated in 3–8 Hz.
    shakeScore: round(clamp01((shakeRatio - 0.3) / 0.4) * clamp01((rmsMps2 - 5) / 5)),
    sampleRateHz: round(sampleRateHz, 1),
  };
}

function round(value: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
