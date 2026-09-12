'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { track } from '@/lib/analytics';
import { apiPost } from '@/lib/client/api';

interface CrewResponse {
  crew: { id: string; slug: string; name: string };
}

/** Create a crew or join one with a code. Two fields, no ceremony. */
export function CrewForms({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (kind: 'create' | 'join') => {
    setBusy(true);
    setError(null);
    try {
      const response = await apiPost<CrewResponse>(
        kind === 'create' ? '/api/crew/create' : '/api/crew/join',
        kind === 'create' ? { name } : { code },
      );
      track(kind === 'create' ? 'crew_created' : 'crew_joined', { crewId: response.crew.id });
      router.push(`/crew/${response.crew.slug}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pad" style={{ paddingBottom: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error ? (
        <p className="mono" role="alert" style={{ color: 'var(--color-coral)', textTransform: 'none' }}>
          {error}
        </p>
      ) : null}

      <div>
        <label className="mono" htmlFor="crew-code" style={{ opacity: 0.6, display: 'block', marginBottom: 8 }}>
          Join with a code
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            id="crew-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={12}
            autoComplete="off"
            style={inputStyle}
          />
          <button
            type="button"
            className="btn"
            style={{ width: 120 }}
            disabled={busy || code.trim().length < 4}
            onClick={() => submit('join')}
          >
            <span>Join</span>
          </button>
        </div>
      </div>

      <div>
        <label className="mono" htmlFor="crew-name" style={{ opacity: 0.6, display: 'block', marginBottom: 8 }}>
          Or start one
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            id="crew-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="IIIFFI"
            maxLength={32}
            autoComplete="off"
            style={inputStyle}
          />
          <button
            type="button"
            className="btn btn-hi"
            style={{ width: 120 }}
            disabled={busy || name.trim().length < 2}
            onClick={() => submit('create')}
          >
            <span>Create</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 56,
  padding: '0 14px',
  border: '2px solid var(--color-ink)',
  background: 'transparent',
  fontFamily: 'var(--font-mono)',
  fontSize: 16,
  letterSpacing: '0.06em',
  color: 'inherit',
};
