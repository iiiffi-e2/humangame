'use client';

import { useState } from 'react';
import { BackLink } from '@/components/ui';
import { GAMES_BY_PILLAR } from '@/features/game-engine/registry';
import { PILLAR_LABEL, type Pillar } from '@/features/game-engine/types';
import { apiPost } from '@/lib/client/api';

interface AdminEvent {
  index: number;
  pillar: Pillar;
  gameId: string;
  difficulty: number;
  voided: boolean;
  summary: string;
}

interface AdminManifest {
  id: string;
  date: string;
  dayNumber: number;
  status: 'draft' | 'frozen';
  version: number;
  stored: boolean;
  events: AdminEvent[];
}

interface TodayStats {
  players: number;
  histogram: number[];
  events: Array<{
    index: number;
    pillar: Pillar;
    gameId: string;
    plays: number;
    averagePoints: number;
    distribution: number[];
  }>;
}

/**
 * Admin console.
 *
 * Deliberately plain: this screen is used when something is wrong, and the
 * operator needs to see what is live, what is frozen, and which button voids
 * the broken event — not a dashboard.
 */
export function AdminBoard({
  manifests,
  today,
}: {
  manifests: AdminManifest[];
  today: TodayStats;
}) {
  const [selected, setSelected] = useState(manifests[0]?.date ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const manifest = manifests.find((entry) => entry.date === selected) ?? manifests[0];

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      await apiPost('/api/admin/manifest', { date: manifest?.date, ...payload });
      setMessage('Saved. Reload to see the stored version.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  const peak = Math.max(1, ...today.histogram);

  return (
    <main id="main" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 64px' }}>
      <div className="statusbar" style={{ padding: 0 }}>
        <BackLink href="/" label="Today" />
        <span className="mono">Admin</span>
      </div>

      <h1 className="disp" style={{ fontSize: 44, marginTop: 16 }}>
        Daily manifests
      </h1>

      {message ? (
        <p className="mono" role="status" style={{ marginTop: 12, textTransform: 'none' }}>
          {message}
        </p>
      ) : null}

      <section style={{ marginTop: 28 }}>
        <h2 className="mono" style={{ opacity: 0.6, fontWeight: 500 }}>
          Today · {today.players.toLocaleString()} ranked runs
        </h2>
        <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 3, marginTop: 12 }}>
          {today.histogram.map((value, index) => (
            <div
              key={index}
              title={`${value} runs`}
              style={{
                flex: 1,
                height: `${Math.max(1, (value / peak) * 100)}%`,
                background: 'var(--color-ink)',
                opacity: value === 0 ? 0.12 : 1,
              }}
            />
          ))}
        </div>
        <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, opacity: 0.6, marginTop: 6 }}>
          <span>0</span>
          <span>5,000</span>
          <span>10,000</span>
        </div>

        <table style={{ width: '100%', marginTop: 20, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr className="mono" style={{ textAlign: 'left', opacity: 0.6 }}>
              <th style={cell}>Event</th>
              <th style={cell}>Family</th>
              <th style={cell}>Plays</th>
              <th style={cell}>Avg points</th>
              <th style={cell}>Spread</th>
            </tr>
          </thead>
          <tbody>
            {today.events.map((event) => (
              <tr key={event.index} style={{ borderTop: '1px solid rgba(17,17,17,.15)' }}>
                <td style={cell}>{PILLAR_LABEL[event.pillar]}</td>
                <td style={cell}>{event.gameId}</td>
                <td style={cell}>{event.plays}</td>
                <td style={cell}>{event.averagePoints}</td>
                <td style={cell}>
                  <span style={{ display: 'flex', gap: 2, height: 18, alignItems: 'flex-end' }}>
                    {event.distribution.map((value, index) => (
                      <span
                        key={index}
                        style={{
                          width: 8,
                          height: `${Math.max(6, (value / Math.max(1, ...event.distribution)) * 100)}%`,
                          background: 'var(--color-ink)',
                          opacity: value === 0 ? 0.15 : 1,
                        }}
                      />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 className="mono" style={{ opacity: 0.6, fontWeight: 500 }}>
          Next 30 days
        </h2>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 12 }}>
          {manifests.map((entry) => (
            <button
              key={entry.date}
              type="button"
              onClick={() => setSelected(entry.date)}
              aria-pressed={entry.date === selected}
              className="mono"
              style={{
                padding: '8px 10px',
                border: '1px solid var(--color-ink)',
                background: entry.date === selected ? 'var(--color-ink)' : 'transparent',
                color: entry.date === selected ? 'var(--color-bone)' : 'inherit',
                cursor: 'pointer',
                opacity: entry.stored ? 1 : 0.55,
              }}
            >
              #{entry.dayNumber}
              {entry.status === 'frozen' ? ' ❄' : ''}
            </button>
          ))}
        </div>
      </section>

      {manifest ? (
        <section style={{ marginTop: 32 }}>
          <h3 className="disp" style={{ fontSize: 30 }}>
            #{manifest.dayNumber} · {manifest.date}
          </h3>
          <p className="mono" style={{ opacity: 0.6, textTransform: 'none' }}>
            {manifest.stored ? `Stored, v${manifest.version}, ${manifest.status}` : 'Not stored yet — previewed from the seed'}
          </p>

          <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr className="mono" style={{ textAlign: 'left', opacity: 0.6 }}>
                <th style={cell}>Pillar</th>
                <th style={cell}>Family</th>
                <th style={cell}>Difficulty</th>
                <th style={cell}>Config</th>
                <th style={cell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {manifest.events.map((event) => (
                <tr
                  key={event.index}
                  style={{
                    borderTop: '1px solid rgba(17,17,17,.15)',
                    background: event.voided ? 'rgba(255,93,69,.2)' : undefined,
                  }}
                >
                  <td style={cell}>{PILLAR_LABEL[event.pillar]}</td>
                  <td style={cell}>
                    <select
                      defaultValue={event.gameId}
                      disabled={busy || manifest.status === 'frozen'}
                      onChange={(changeEvent) =>
                        act({
                          action: 'replace-family',
                          pillar: event.pillar,
                          gameId: changeEvent.target.value,
                        })
                      }
                      style={{ minHeight: 36, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                    >
                      {GAMES_BY_PILLAR[event.pillar].map((definition) => (
                        <option key={definition.id} value={definition.id}>
                          {definition.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={cell}>{event.difficulty.toFixed(2)}</td>
                  <td style={{ ...cell, fontFamily: 'var(--font-mono)', fontSize: 11, maxWidth: 320 }}>
                    {event.summary}
                  </td>
                  <td style={cell}>
                    <button
                      type="button"
                      className="mono"
                      disabled={busy || event.voided}
                      onClick={() => act({ action: 'void-event', eventIndex: event.index })}
                      style={smallButton}
                    >
                      {event.voided ? 'Voided' : 'Void'}
                    </button>
                    {event.pillar === 'crowd' ? (
                      <button
                        type="button"
                        className="mono"
                        disabled={busy}
                        onClick={() => {
                          const weight = Number(window.prompt('Prior weight (pseudo-responses)', '400'));
                          if (!Number.isFinite(weight) || weight < 1) return;
                          void act({ action: 'set-crowd-prior', eventIndex: event.index, prior: { weight } });
                        }}
                        style={smallButton}
                      >
                        Prior
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button type="button" className="mono" disabled={busy} onClick={() => act({ action: 'regenerate' })} style={smallButton}>
              Regenerate
            </button>
            <button
              type="button"
              className="mono"
              disabled={busy}
              onClick={() => act({ action: manifest.status === 'frozen' ? 'unfreeze' : 'freeze' })}
              style={smallButton}
            >
              {manifest.status === 'frozen' ? 'Unfreeze' : 'Freeze & publish'}
            </button>
            <button
              type="button"
              className="mono"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Void every event for this day?')) void act({ action: 'void-day' });
              }}
              style={{ ...smallButton, borderColor: 'var(--color-coral)', color: 'var(--color-coral)' }}
            >
              Void the whole day
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

const cell: React.CSSProperties = { padding: '10px 8px', verticalAlign: 'middle' };

const smallButton: React.CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  border: '1px solid var(--color-ink)',
  background: 'transparent',
  cursor: 'pointer',
  marginRight: 8,
  color: 'inherit',
};
