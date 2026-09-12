'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/client/api';

/** File a moderation report. Deliberately short: a target and a sentence. */
export function ReportForm() {
  const [subjectType, setSubjectType] = useState<'player' | 'crew'>('player');
  const [subjectId, setSubjectId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await apiPost('/api/report', { subjectType, subjectId, reason });
      setSubjectId('');
      setReason('');
      setMessage('Reported. Thank you.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send that.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pad" style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {message ? (
        <p className="mono" role="status" style={{ opacity: 0.75, textTransform: 'none' }}>
          {message}
        </p>
      ) : null}

      <label className="mono" htmlFor="subject-type" style={{ opacity: 0.6 }}>
        What
      </label>
      <select
        id="subject-type"
        value={subjectType}
        onChange={(event) => setSubjectType(event.target.value as 'player' | 'crew')}
        style={{ ...field, fontFamily: 'var(--font-mono)' }}
      >
        <option value="player">A player</option>
        <option value="crew">A crew</option>
      </select>

      <label className="mono" htmlFor="subject-id" style={{ opacity: 0.6 }}>
        Username or crew name
      </label>
      <input
        id="subject-id"
        value={subjectId}
        onChange={(event) => setSubjectId(event.target.value)}
        maxLength={64}
        style={field}
      />

      <label className="mono" htmlFor="reason" style={{ opacity: 0.6 }}>
        Why
      </label>
      <textarea
        id="reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        maxLength={500}
        style={{ ...field, minHeight: 90, padding: 12, resize: 'vertical' }}
      />

      <button
        type="button"
        className="btn"
        disabled={busy || subjectId.trim().length < 2 || reason.trim().length < 3}
        onClick={submit}
      >
        <span>Send report</span>
        <span aria-hidden>&rarr;</span>
      </button>
    </div>
  );
}

const field: React.CSSProperties = {
  minHeight: 52,
  padding: '0 14px',
  border: '2px solid var(--color-ink)',
  background: 'transparent',
  fontSize: 15,
  color: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};
