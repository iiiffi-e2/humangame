'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/client/api';

export function BlockForm({
  blocked,
}: {
  blocked: Array<{ id: string; displayName: string; username: string | null }>;
}) {
  const [target, setTarget] = useState('');
  const [rows, setRows] = useState(blocked);
  const [message, setMessage] = useState<string | null>(null);

  const act = async (action: 'block' | 'unblock', who: string) => {
    setMessage(null);
    try {
      const result = (await apiPost('/api/player/block', { action, target: who })) as {
        blockedIds: string[];
      };
      if (action === 'unblock') {
        setRows((current) => current.filter((row) => row.username !== who && row.id !== who));
      } else {
        setTarget('');
        setMessage(`Blocked. ${result.blockedIds.length} on your list.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not do that.');
    }
  };

  return (
    <section className="pad" style={{ paddingTop: 8 }}>
      <h2 className="mono" style={{ opacity: 0.5, fontWeight: 500 }}>
        Blocked
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.45, opacity: 0.75, marginTop: 8 }}>
        Blocked players leave your friends rail and cannot send you a rivalry.
      </p>
      {message ? (
        <p className="mono" role="status" style={{ marginTop: 10, opacity: 0.75 }}>
          {message}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="username"
          maxLength={16}
          style={{
            flex: 1,
            minHeight: 52,
            padding: '0 14px',
            border: '2px solid var(--color-ink)',
            background: 'transparent',
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            color: 'inherit',
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={target.trim().length < 3}
          onClick={() => void act('block', target.trim())}
        >
          <span>Block</span>
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="mono" style={{ opacity: 0.55, marginTop: 12, textTransform: 'none' }}>
          Nobody blocked.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
          {rows.map((row) => (
            <li
              key={row.id}
              style={{
                borderTop: '1px solid rgba(17,17,17,.2)',
                minHeight: 52,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{row.username ? `@${row.username}` : row.displayName}</span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void act('unblock', row.username ?? row.id)}
              >
                <span>Unblock</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
