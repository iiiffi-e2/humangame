'use client';

import { useState } from 'react';
import { BackLink } from '@/components/ui';
import type { ModerationReport } from '@/lib/db/types';
import { apiPost } from '@/lib/client/api';

export function AdminReports({ reports }: { reports: ModerationReport[] }) {
  const [rows, setRows] = useState(reports);
  const [message, setMessage] = useState<string | null>(null);

  const act = async (id: string, action: 'dismiss' | 'hide') => {
    setMessage(null);
    try {
      await apiPost('/api/admin/reports', { id, action });
      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, status: action === 'dismiss' ? 'reviewed' : 'actioned' } : row,
        ),
      );
      setMessage(action === 'hide' ? 'Hidden from named boards.' : 'Dismissed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That did not work.');
    }
  };

  return (
    <main id="main" style={{ maxWidth: 800, margin: '0 auto', padding: '24px 24px 64px' }}>
      <div className="statusbar" style={{ padding: 0 }}>
        <BackLink href="/admin" label="Admin" />
        <span className="mono">Reports</span>
      </div>
      <h1 className="disp" style={{ fontSize: 40, margin: '16px 0 8px' }}>
        Reports
      </h1>
      <p style={{ opacity: 0.75, maxWidth: 420 }}>
        Hide removes a name from public boards. It is not a ban — they can still play.
      </p>
      {message ? (
        <p className="mono" role="status" style={{ marginTop: 16, opacity: 0.75 }}>
          {message}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="mono" style={{ marginTop: 24, opacity: 0.6 }}>
          Queue is empty.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0 }}>
          {rows.map((report) => (
            <li
              key={report.id}
              style={{
                borderTop: '1px solid rgba(17,17,17,.2)',
                padding: '14px 0',
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>
                  {report.subjectType} · {report.subjectId}
                </span>
                <span className="mono" style={{ opacity: 0.6 }}>
                  {report.status}
                </span>
              </div>
              <span style={{ fontSize: 14, opacity: 0.75 }}>{report.reason}</span>
              {report.status === 'open' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn" onClick={() => void act(report.id, 'dismiss')}>
                    <span>Dismiss</span>
                  </button>
                  <button type="button" className="btn btn-hi" onClick={() => void act(report.id, 'hide')}>
                    <span>Hide from boards</span>
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
