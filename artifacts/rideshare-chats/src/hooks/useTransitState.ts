import { useCallback, useEffect, useRef, useState } from "react";

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
  const stateRef = useRef<TransitState>("ACTIVE_TRANSIT");

  const dispatchPayload = useCallback((payload: TransitPayload) => {
    if (payload.type === "SENSOR_UPDATE") {
      // Only the first slow sample in an active ride starts grace; sensor chatter cannot extend it.
      if (payload.speedMph >= 15 || stateRef.current !== "ACTIVE_TRANSIT") return;
      stateRef.current = "GRACE_PERIOD_PENDING";
      setGraceDeadline(Date.now() + GRACE_SECONDS * 1000);
      setSecondsRemaining(GRACE_SECONDS);
      setTransitState("GRACE_PERIOD_PENDING");
    } else if (payload.type === "MOTION_RESUMED") {
      stateRef.current = "ACTIVE_TRANSIT";
      setGraceDeadline(null);
      setSecondsRemaining(GRACE_SECONDS);
      setTransitState("ACTIVE_TRANSIT");
    } else {
      stateRef.current = "DISCONNECTED";
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
        stateRef.current = "DISCONNECTED";
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