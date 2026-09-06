import { useState, useRef, useCallback } from 'react';

/**
 * useLivePulse
 * ─────────────
 * Returns a display value and a trigger function. When the value changes,
 * calling `trigger(newValue)` briefly plays a pulse animation (ring + flash)
 * on the element to visibly signal a live Socket.io update.
 *
 * Usage:
 *   const { displayValue, isPulsing, trigger } = useLivePulse(initialValue);
 *   // In your Socket.io event handler:
 *   socket.on('STOCK_UPDATED', (p) => trigger(p.available));
 *
 * The `isPulsing` boolean should be applied as a className toggle:
 *   <span className={`... ${isPulsing ? 'animate-pulse-ring animate-count-flash' : ''}`}>
 *     {displayValue}
 *   </span>
 *
 * Pulse duration: 900ms, then isPulsing resets to false.
 * Respects prefers-reduced-motion — skips the animation, still updates value.
 */
export function useLivePulse(initialValue) {
  const [displayValue, setDisplayValue] = useState(initialValue);
  const [isPulsing,    setIsPulsing]    = useState(false);
  const timerRef = useRef(null);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const trigger = useCallback((newValue) => {
    setDisplayValue(newValue);

    if (reducedMotion) return;  // skip animation, value still updates

    // Clear any in-flight pulse
    if (timerRef.current) clearTimeout(timerRef.current);

    setIsPulsing(true);
    timerRef.current = setTimeout(() => setIsPulsing(false), 900);
  }, [reducedMotion]);

  return { displayValue, isPulsing, trigger };
}
