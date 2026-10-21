import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { routes } from '@/constants/routes';
import { TelemetryCollector } from '@/lib/telemetry/collector';
import { useAuthStore } from '@/stores/auth.store';
import { useSimulatorStore } from '@/stores/simulator.store';
import { useTripStore } from '@/stores/trip.store';

const KEEP_AWAKE_TAG = 'trip-session';

/** Screens where an unverified rider is waiting to be verified. */
const VALIDATION_SCREENS: ReadonlySet<string> = new Set([routes.discover, routes.validation, routes.vibeSelection]);

/** Releasing a wake lock that was never acquired throws (notably on web). */
function releaseKeepAwake(): void {
  try {
    void Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch(() => undefined);
  } catch {
    // not active
  }
}

/**
 * Runs the telemetry collector while a trip is active and handles trip-wide navigation:
 * TERMINATED ends on the Ride Summary. Traffic grace is deliberately quiet (client feedback: city
 * rides stop at every light) — only the small grace chip in the room header shows it.
 * Renders nothing.
 */
export function TripSessionHost() {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const active = useTripStore((s) => s.active);
  const inRoom = useTripStore((s) => s.room != null);
  const state = useTripStore((s) => s.snapshot?.state);
  const termination = useTripStore((s) => s.termination);
  const collector = useRef<TelemetryCollector | null>(null);

  // Before a ride is verified, sensors run only on the screens that need them (Home, Trip
  // Validation, mood picker). Once a ride is under way they keep running everywhere, so a rider can
  // open Settings mid-ride without their trip timing out.
  const rideUnderway = state === 'VERIFIED' || state === 'GRACE' || state === 'POST_RIDE' || inRoom;
  const onValidationScreen = VALIDATION_SCREENS.has(pathname);
  const collecting = active && isAuthenticated && (rideUnderway || onValidationScreen);

  // Collector lifecycle.
  useEffect(() => {
    if (!collecting) {
      collector.current?.stop();
      collector.current = null;
      useTripStore.getState().setPowerSaver(false);
      releaseKeepAwake();
      return;
    }
    const instance = new TelemetryCollector({
      onSnapshot: (snapshot) => useTripStore.getState().setSnapshot(snapshot),
      onPowerChange: (mode) => useTripStore.getState().setPowerSaver(mode === 'saver'),
      getScenario: () => useSimulatorStore.getState().scenario,
    });
    collector.current = instance;
    void instance.start(useTripStore.getState().room ? 'in_room' : 'pre_verification');
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      instance.stop();
      useTripStore.getState().setPowerSaver(false);
      releaseKeepAwake();
    };
  }, [collecting]);

  // 2 s polling before verification, 10 s inside a R.O.O.M.
  useEffect(() => {
    collector.current?.setMode(inRoom ? 'in_room' : 'pre_verification');
  }, [inRoom]);

  // Termination → ride summary.
  useEffect(() => {
    if (!termination || !active) return;
    if (pathname !== routes.rideSummary) router.replace(routes.rideSummary);
  }, [termination, active, pathname, router]);

  return null;
}
