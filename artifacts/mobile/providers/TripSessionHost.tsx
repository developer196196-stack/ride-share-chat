import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { routes } from '@/constants/routes';
import { TelemetryCollector } from '@/lib/telemetry/collector';
import { useAuthStore } from '@/stores/auth.store';
import { useSimulatorStore } from '@/stores/simulator.store';
import { useTripStore } from '@/stores/trip.store';

const KEEP_AWAKE_TAG = 'trip-session';

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
 * GRACE inside a R.O.O.M. opens the Traffic Grace screen; TERMINATED ends on the Ride Summary.
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

  // Collector lifecycle.
  useEffect(() => {
    if (!active || !isAuthenticated) {
      collector.current?.stop();
      collector.current = null;
      releaseKeepAwake();
      return;
    }
    const instance = new TelemetryCollector({
      onSnapshot: (snapshot) => useTripStore.getState().setSnapshot(snapshot),
      getScenario: () => useSimulatorStore.getState().scenario,
    });
    collector.current = instance;
    void instance.start(useTripStore.getState().room ? 'in_room' : 'pre_verification');
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      instance.stop();
      releaseKeepAwake();
    };
  }, [active, isAuthenticated]);

  // 2 s polling before verification, 10 s inside a R.O.O.M.
  useEffect(() => {
    collector.current?.setMode(inRoom ? 'in_room' : 'pre_verification');
  }, [inRoom]);

  // Traffic grace overlay while in a room.
  useEffect(() => {
    if (state === 'GRACE' && inRoom && pathname === routes.activeRoom) {
      router.push(routes.trafficGrace);
    }
  }, [state, inRoom, pathname, router]);

  // Termination → ride summary.
  useEffect(() => {
    if (!termination || !active) return;
    if (pathname !== routes.rideSummary) router.replace(routes.rideSummary);
  }, [termination, active, pathname, router]);

  return null;
}
