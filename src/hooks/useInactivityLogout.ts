import { useEffect, useRef } from 'react';
import {
  INACTIVITY_ACTIVITY_THROTTLE_MS,
  INACTIVITY_TIMEOUT_MS,
} from '../config/session';

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'focusin',
] as const;

export function useInactivityLogout(onTimeout: () => void, enabled = true) {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!enabled) return;

    let timerId = 0;
    let lastActivityAt = 0;

    const scheduleLogout = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        onTimeoutRef.current();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityAt < INACTIVITY_ACTIVITY_THROTTLE_MS) {
        return;
      }
      lastActivityAt = now;
      scheduleLogout();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleActivity();
      }
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    scheduleLogout();

    return () => {
      window.clearTimeout(timerId);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
}
