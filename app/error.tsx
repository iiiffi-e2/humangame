'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { reportError } from '@/lib/observability';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { where: 'app/error', extra: { digest: error.digest } });
  }, [error]);

  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <span>HUMAN</span>
        <span className="mono" style={{ color: 'var(--color-coral)' }}>
          Error
        </span>
      </div>
      <div className="pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 className="disp" style={{ fontSize: 'min(56px, 14vw)', margin: 0 }}>
          That broke.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.4, marginTop: 18, opacity: 0.8, maxWidth: 320 }}>
          A run in progress is saved on the server, so nothing is lost. Try again.
        </p>
      </div>
      <div className="pad" style={{ paddingBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" className="btn btn-hi" onClick={reset}>
          <span>Try again</span>
          <span aria-hidden>&rarr;</span>
        </button>
        <Link href="/" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          <span>Back to today</span>
        </Link>
      </div>
    </main>
  );
}
