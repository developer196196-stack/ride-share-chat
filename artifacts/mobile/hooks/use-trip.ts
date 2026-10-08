import { useCallback } from 'react';
import { resetValidation, getValidationState } from '@workspace/api-client-react';
import { useTripStore } from '@/stores/trip.store';

/** Starts (or resumes) a trip session: telemetry collection on, previous termination cleared. */
export function useTrip() {
  const startTrip = useCallback(async () => {
    const store = useTripStore.getState();
    store.setTermination(null);
    store.setSummary(null);
    store.setSharePromptPending(false);
    try {
      const current = await getValidationState();
      // A finished session must start fresh; otherwise keep the live state (e.g. app reopened mid-ride).
      const snapshot = current.state === 'TERMINATED' ? await resetValidation() : current;
      store.setSnapshot(snapshot);
    } catch {
      // Offline / API down: the collector will report errors; still start collecting.
    }
    store.setActive(true);
  }, []);

  const stopTrip = useCallback(() => {
    const store = useTripStore.getState();
    store.setActive(false);
    store.setRoom(null);
  }, []);

  return { startTrip, stopTrip };
}
