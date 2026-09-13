import Link from 'next/link';
import { DesktopNav } from '@/components/Chrome';
import { Wordmark } from '@/components/ui';
import { PILLAR_LABEL, PILLARS } from '@/features/game-engine/types';
import { requirePlayer } from '@/lib/auth/session';
import { currentDateKey, msUntilReset } from '@/lib/daily/reset';
import { ensureManifest } from '@/lib/daily/service';
import { getHistory } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'History' };

/**
 * Thirty days of record. Deliberately a scoreboard rather than a wellness
 * chart: no rings, no streak guilt, no trend line dressed up as progress —
 * just the days you played and the days you did not.
 */
export default async function HistoryPage() {
  const player = await requirePlayer();
  const [history, manifest] = await Promise.all([getHistory(player), ensureManifest(currentDateKey())]);
  const peak = Math.max(1, ...history.days.map((day) => day.score ?? 0));

  return (
    <>
      <DesktopNav
        dayNumber={manifest.dayNumber}
        date={manifest.date}
        resetInMs={msUntilReset()}
        displayName={player.displayName}
        active="history"
      />
      <main id="main" className="phone">
        <div className="statusbar">
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Wordmark size={22} />
          </Link>
          <span className="mono">History &middot; 30d</span>
        </div>

        {!history.hasHistory ? (
          <div className="pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 className="disp" style={{ fontSize: 'min(44px, 11vw)', margin: 0 }}>
              No days yet.
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.45, marginTop: 12, opacity: 0.75, maxWidth: 320 }}>
              Your first run starts your record. Nothing here is scored against you.
            </p>
            <Link href="/play" className="btn btn-hi" style={{ marginTop: 28, textDecoration: 'none' }}>
              <span>Play #{manifest.dayNumber}</span>
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        ) : (
          <>
            <div
              className="pad"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                borderTop: '1px solid var(--color-ink)',
                borderBottom: '1px solid var(--color-ink)',
                marginTop: 8,
              }}
            >
              <Cell label="Avg percentile" value={`Top ${Math.max(1, 100 - history.averagePercentile)}%`} />
              <Cell
                label="Strongest"
                value={history.strongest ? PILLAR_LABEL[history.strongest] : '—'}
                bordered
              />
              <Cell
                label="Best day"
                value={(history.best?.score ?? 0).toLocaleString()}
                note={history.best ? `#${history.best.dayNumber}` : undefined}
                topBorder
              />
              <Cell
                label="Longest streak"
                value={history.longestStreak}
                note={`Current ${history.currentStreak}`}
                bordered
                topBorder
              />
            </div>

            <div className="pad" style={{ paddingTop: 22 }}>
              <div
                className="mono"
                style={{ opacity: 0.6, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}
              >
                <span>Score · last 30</span>
                <span>Median {history.medianToday.toLocaleString()} ---</span>
              </div>
              <div style={{ position: 'relative', height: 120, borderBottom: '1px solid var(--color-ink)' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: `${100 - (history.medianToday / 10_000) * 100}%`,
                    borderTop: '1px dashed var(--color-gray)',
                  }}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
                  {history.days.map((day, index) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.score?.toLocaleString() ?? 'missed'}`}
                      style={{
                        flex: 1,
                        height: day.score === null ? 0 : `${(day.score / peak) * 100}%`,
                        background:
                          index === history.days.length - 1
                            ? 'var(--color-chartreuse)'
                            : 'var(--color-ink)',
                        outline:
                          index === history.days.length - 1 ? '2px solid var(--color-ink)' : 'none',
                        borderTop: day.score === null ? '2px dashed var(--color-gray)' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="pad" style={{ paddingTop: 22 }}>
              <div className="mono" style={{ opacity: 0.6, marginBottom: 10 }}>
                Pillars · 30-day average
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {PILLARS.map((pillar) => {
                  const value = history.pillars[pillar];
                  const strongest = pillar === history.strongest;
                  const weakest = pillar === history.weakest;
                  return (
                    <div
                      key={pillar}
                      style={{
                        borderTop: '3px solid var(--color-ink)',
                        paddingTop: 8,
                        background: strongest ? 'var(--color-chartreuse)' : 'transparent',
                        margin: strongest ? '-8px -4px 0' : undefined,
                        padding: strongest ? '8px 4px 4px' : undefined,
                      }}
                    >
                      <div
                        className="num"
                        style={{ fontSize: 30, color: weakest && !strongest ? 'var(--color-coral)' : undefined }}
                      >
                        {value}
                      </div>
                      <div className="mono" style={{ fontSize: 9, opacity: strongest ? 1 : 0.6 }}>
                        {PILLAR_LABEL[pillar]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 24 }} />

            <div className="pad" style={{ paddingBottom: 28 }}>
              <Link href="/practice" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                <span>Practice {history.weakest ? PILLAR_LABEL[history.weakest] : 'today'}</span>
                <span aria-hidden>&rarr;</span>
              </Link>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function Cell({
  label,
  value,
  note,
  bordered,
  topBorder,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  bordered?: boolean;
  topBorder?: boolean;
}) {
  return (
    <div
      style={{
        padding: bordered ? '12px 0 12px 14px' : '12px 0',
        borderLeft: bordered ? '1px solid var(--color-ink)' : undefined,
        borderTop: topBorder ? '1px solid var(--color-ink)' : undefined,
      }}
    >
      <div className="mono" style={{ opacity: 0.6 }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 36, marginTop: 6 }}>
        {value}
      </div>
      {note ? (
        <div className="mono" style={{ fontSize: 9, opacity: 0.5, marginTop: 2 }}>
          {note}
        </div>
      ) : null}
    </div>
  );
}
