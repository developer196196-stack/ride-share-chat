import { useCallback, useEffect, useState } from "react";

export type TransitState = "ACTIVE_TRANSIT" | "GRACE_PERIOD_PENDING" | "DISCONNECTED";

export type TransitPayload =
  | { type: "SENSOR_UPDATE"; speedMph: number }
  | { type: "MOTION_RESUMED" }
  | { type: "RIDE_END"; reason: "TIMER_EXPIRED" };

const GRACE_SECONDS = 5 * 60;

export function useTransitState() {
  const [transitState, setTransitState] = useState<TransitState>("ACTIVE_TRANSIT");
  const [secondsRemaining, setSecondsRemaining] = useState(GRACE_SECONDS);
  const [graceDeadline, setGraceDeadline] = useState<number | null>(null);

  const dispatchPayload = useCallback((payload: TransitPayload) => {
    if (payload.type === "SENSOR_UPDATE") {
      if (payload.speedMph >= 15) return;
      setGraceDeadline(Date.now() + GRACE_SECONDS * 1000);
      setSecondsRemaining(GRACE_SECONDS);
      setTransitState("GRACE_PERIOD_PENDING");
    } else if (payload.type === "MOTION_RESUMED") {
      setGraceDeadline(null);
      setSecondsRemaining(GRACE_SECONDS);
      setTransitState("ACTIVE_TRANSIT");
    } else {
      setGraceDeadline(null);
      setSecondsRemaining(0);
      setTransitState("DISCONNECTED");
    }
  }, []);

  useEffect(() => {
    if (transitState !== "GRACE_PERIOD_PENDING" || graceDeadline === null) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((graceDeadline - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        setTransitState("DISCONNECTED");
        setGraceDeadline(null);
      }
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [graceDeadline, transitState]);

  return { transitState, secondsRemaining, dispatchPayload };
}