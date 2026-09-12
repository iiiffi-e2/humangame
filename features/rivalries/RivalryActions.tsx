'use client';

import { useState } from 'react';
import { track } from '@/lib/analytics';
import { apiPost } from '@/lib/client/api';

/**
 * The two things you can do about a rival: make it official, and make it
 * personal. Both are one tap, both are reversible.
 */
export function RivalryActions({
  rivalId,
  rivalName,
  isActive,
  isNemesis,
}: {
  rivalId: string;
  rivalName: string;
  isActive: boolean;
  isNemesis: boolean;
}) {
  const [active, setActive] = useState(isActive);
  const [nemesis, setNemesis] = useState(isNemesis);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const call = async (action: 'request' | 'accept' | 'nemesis' | 'unnemesis') => {
    setBusy(true);
    try {
      const response = await apiPost<{ rivalry: { status: string; nemesisFor: string[] } }>(
        '/api/rivalry',
        { action, target: rivalId },
      );
      setActive(response.rivalry.status === 'active');
      if (action === 'request') {
        track('rivalry_requested', { target: rivalId });
        setMessage(`Asked ${rivalName}. It goes live when they accept.`);
      }
      if (action === 'accept') {
        track('rivalry_accepted', { target: rivalId });
        setMessage('Rivalry is live.');
      }
      if (action === 'nemesis' || action === 'unnemesis') {
        setNemesis(action === 'nemesis');
        setMessage(action === 'nemesis' ? `${rivalName} is your nemesis.` : 'Unpinned.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pad" style={{ paddingBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {message ? (
        <p className="mono" role="status" style={{ opacity: 0.7, textTransform: 'none' }}>
          {message}
        </p>
      ) : null}

      {!active ? (
        <>
          <button type="button" className="btn btn-cobalt" disabled={busy} onClick={() => call('request')}>
            <span>Challenge {rivalName}</span>
            <span aria-hidden>&rarr;</span>
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => call('accept')}>
            <span>Accept their request</span>
          </button>
        </>
      ) : (
        <button
          type="button"
          className={nemesis ? 'btn btn-ghost' : 'btn btn-cobalt'}
          disabled={busy}
          onClick={() => call(nemesis ? 'unnemesis' : 'nemesis')}
        >
          <span>{nemesis ? `${rivalName} is your nemesis` : `Make ${rivalName} your nemesis`}</span>
          <span aria-hidden>{nemesis ? '★' : '→'}</span>
        </button>
      )}
    </div>
  );
}
