/**
 * Dev-only simulated ride. Produces telemetry that exercises every engine path (drive,
 * red light in a petrol car, stop in an EV, getting out and walking) on emulators and web.
 * Samples carry `simulated: true`; production servers reject them.
 */
import type { TelemetrySample } from '@workspace/api-client-react';
import type { SimulatorScenario } from '@/stores/simulator.store';

const MPH = 0.44704;
const METERS_PER_DEG_LAT = 111_320;

type Position = { lat: number; lng: number; t: number };

const SCENARIOS: Record<Exclude<SimulatorScenario, 'off'>, { mph: number; vib: number; walking: number; activity: { type: NonNullable<TelemetrySample['activity']>['type']; confidence: number } }> = {
  driving: { mph: 27, vib: 0.32, walking: 0, activity: { type: 'in_vehicle', confidence: 90 } },
  stopped_idle: { mph: 0, vib: 0.3, walking: 0, activity: { type: 'in_vehicle', confidence: 75 } },
  stopped_ev: { mph: 0, vib: 0.02, walking: 0, activity: { type: 'still', confidence: 80 } },
  walking: { mph: 3, vib: 0.05, walking: 0.85, activity: { type: 'walking', confidence: 85 } },
};

export class RideSimulator {
  private position: Position | null = null;

  /** Starts from the rider's real position when known, so the share map looks sensible. */
  seed(lat: number, lng: number): void {
    if (!this.position) this.position = { lat, lng, t: Date.now() };
  }

  next(scenario: Exclude<SimulatorScenario, 'off'>): TelemetrySample {
    const now = Date.now();
    const s = SCENARIOS[scenario];
    const prev = this.position ?? { lat: 37.7749, lng: -122.4194, t: now };
    const dt = Math.max(0, (now - prev.t) / 1000);
    const meters = s.mph * MPH * dt;
    // Heading north-east.
    const lat = prev.lat + (meters * Math.SQRT1_2) / METERS_PER_DEG_LAT;
    const lng = prev.lng + (meters * Math.SQRT1_2) / (METERS_PER_DEG_LAT * Math.cos((prev.lat * Math.PI) / 180));
    this.position = { lat, lng, t: now };

    return {
      simulated: true,
      gps: { lat, lng, speedMps: s.mph * MPH, accuracyM: 6, timestamp: now, isMock: true },
      vibration: {
        vehicleBandRatio: s.vib,
        dominantHz: s.walking > 0 ? 2 : 15,
        rmsMps2: s.walking > 0 ? 1.8 : 0.2,
        walkingScore: s.walking,
        shakeScore: 0,
        sampleRateHz: 100,
      },
      activity: s.activity,
    };
  }
}
