'use client';

import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/daily/reset';

/**
 * The reset clock. Server-rendered with the correct value, then ticked in the
 * browser so a tab left open overnight does not lie about the day.
 */
export function ResetCountdown({ initialMs }: { initialMs: number }) {
  const [remaining, setRemaining] = useState(initialMs);

  useEffect(() => {
    // Count down from the value the server rendered, using elapsed wall time
    // rather than a tick counter so a throttled background tab catches up.
    const renderedAt = Date.now();
    const timer = setInterval(() => {
      setRemaining(Math.max(0, initialMs - (Date.now() - renderedAt)));
    }, 1000);
    return () => clearInterval(timer);
  }, [initialMs]);

  return <span suppressHydrationWarning>Resets {formatCountdown(remaining)}</span>;
}
