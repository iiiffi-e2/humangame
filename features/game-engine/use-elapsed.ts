'use client';

import { useEffect, useRef } from 'react';

/**
 * Monotonic elapsed ms from when `active` became true.
 * Stamped in an effect, matching the existing Next / Rotate clocks.
 */
export function useElapsed(active = true): () => number {
  const startRef = useRef(0);
  useEffect(() => {
    if (active) startRef.current = performance.now();
  }, [active]);
  return () => Math.round(performance.now() - startRef.current);
}
