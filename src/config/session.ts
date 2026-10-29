/** Global session timeout — automatic logout after this period of inactivity. */
export const INACTIVITY_TIMEOUT_MINUTES = 30;

export const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;

/** Throttle activity detection to avoid resetting the timer on every mousemove. */
export const INACTIVITY_ACTIVITY_THROTTLE_MS = 1000;
