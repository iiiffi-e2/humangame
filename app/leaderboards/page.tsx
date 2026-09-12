import Link from 'next/link';
import { DesktopNav } from '@/components/Chrome';
import { BoardTracker } from '@/features/leaderboards/BoardTracker';
import { Avatar, Wordmark } from '@/components/ui';
import { requirePlayer } from '@/lib/auth/session';
import { currentDateKey, msUntilReset } from '@/lib/daily/reset';
import { getLeaderboard, type LeaderboardTab, type MonthRow } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Leaderboards' };

const TABS: Array<[LeaderboardTab, string]> = [
  ['friends', 'Friends'],
  ['crews', 'Crews'],
  ['global', 'Global'],
  ['country', 'Country'],
  ['month', 'Month'],
];

/**
 * Standings, read like a sports table: rank, who, score, percentile, movement.
 * Exact scores stay sealed until the viewer has played — the row still shows
 * that someone has finished, which is the part that makes people play.
 */
export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const player = await requirePlayer();
  const params = await searchParams;
  const tab = (TABS.map(([key]) => key).find((key) => key === params.tab) ??
    'friends') as LeaderboardTab;
  const board = await getLeaderboard(player, tab);

  return (
    <>
      <DesktopNav
        dayNumber={board.dayNumber}
        date={currentDateKey()}
        resetInMs={msUntilReset()}
        displayName={player.displayName}
        active="leaderboards"
      />
      <BoardTracker tab={tab} />

      <main id="main" className="phone">
        <div className="statusbar">
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Wordmark size={22} />
          </Link>
          <span className="mono">#{board.dayNumber} &middot; Today</span>
        </div>

        <nav
          className="pad mono"
          aria-label="Leaderboard scope"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
            fontSize: 10,
            marginTop: 8,
            borderBottom: '2px solid var(--color-ink)',
          }}
        >
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              href={`/leaderboards?tab=${key}`}
              aria-current={key === tab ? 'page' : undefined}
              style={{
                padding: '12px 0',
                textAlign: 'center',
                textDecoration: 'none',
                background: key === tab ? 'var(--color-ink)' : 'transparent',
                color: key === tab ? 'var(--color-bone)' : 'inherit',
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {!board.viewerHasPlayed ? (
          <p
            className="pad mono"
            style={{ paddingTop: 14, opacity: 0.7, textTransform: 'none', letterSpacing: '0.02em' }}
          >
            Scores stay sealed until you finish today&rsquo;s run.
          </p>
        ) : null}

        {board.note ? (
          <p className="pad mono" style={{ paddingTop: 12, opacity: 0.6, textTransform: 'none' }}>
            {board.note}
          </p>
        ) : null}

        {tab === 'month' ? (
          <MonthTable rows={board.monthRows} />
        ) : (
          <>
        <div
          className="pad mono"
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 32px 1fr 64px 44px',
            gap: 10,
            paddingTop: 10,
            paddingBottom: 6,
            opacity: 0.5,
          }}
        >
          <span>#</span>
          <span />
          <span>Player</span>
          <span style={{ textAlign: 'right' }}>Score</span>
          <span style={{ textAlign: 'right' }}>Top</span>
        </div>

        <ol className="pad" style={{ display: 'flex', flexDirection: 'column', margin: 0, padding: '0 24px', listStyle: 'none' }}>
          {board.rows.map((row) => (
            <li
              key={row.playerId}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 32px 1fr 64px 44px',
                gap: 10,
                alignItems: 'center',
                minHeight: 56,
                borderTop: '1px solid rgba(17,17,17,.15)',
                background: row.isViewer ? 'var(--color-chartreuse)' : 'transparent',
                margin: row.isViewer ? '0 -24px' : undefined,
                padding: row.isViewer ? '0 24px' : undefined,
                opacity: row.played ? 1 : 0.5,
              }}
            >
              <span className="num" style={{ fontSize: 22 }}>
                {row.played ? row.rank : '—'}
              </span>
              <Avatar
                name={row.displayName}
                size={32}
                tone={row.isNemesis ? 'cobalt' : row.isViewer ? 'ink' : 'gray'}
                dashed={!row.played}
              />
              <span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {row.displayName}
                  {row.isViewer ? (
                    <span className="mono" style={{ fontSize: 9, marginLeft: 6 }}>
                      You
                    </span>
                  ) : null}
                  {row.isNemesis ? (
                    <span className="mono" style={{ fontSize: 9, marginLeft: 6, color: 'var(--color-cobalt)' }}>
                      Nemesis
                    </span>
                  ) : null}
                </span>
                <span className="mono" style={{ fontSize: 9, opacity: 0.55, display: 'block' }}>
                  {row.played ? movementLabel(row.movement) : 'Not played yet'}
                </span>
              </span>
              <span className="num" style={{ fontSize: 24, textAlign: 'right' }}>
                {row.score === null ? (row.played ? '••••' : '') : row.score.toLocaleString()}
              </span>
              <span className="mono" style={{ textAlign: 'right', fontSize: 10 }}>
                {row.percentile === null ? '' : `${Math.max(1, Math.round(100 - row.percentile))}%`}
              </span>
            </li>
          ))}
        </ol>
          </>
        )}

        {board.rows.length === 0 && board.monthRows.length === 0 ? (
          <p className="pad" style={{ paddingTop: 24, fontSize: 15, lineHeight: 1.4, opacity: 0.75 }}>
            Nothing here yet. Finish a run and send someone the link — this board fills up fast.
          </p>
        ) : null}

        <div style={{ flex: 1, minHeight: 24 }} />

        <div className="pad" style={{ paddingBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/crews" className="btn" style={{ textDecoration: 'none' }}>
            <span>{tab === 'crews' ? 'Manage crews' : 'Find your crew'}</span>
            <span aria-hidden>+</span>
          </Link>
        </div>
      </main>
    </>
  );
}

/** Month consistency: placement points, days played, best day. */
function MonthTable({ rows }: { rows: MonthRow[] }) {
  return (
    <>
      <div
        className="pad mono"
        style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 56px 56px',
          gap: 10,
          paddingTop: 10,
          paddingBottom: 6,
          opacity: 0.5,
        }}
      >
        <span>#</span>
        <span>Player</span>
        <span style={{ textAlign: 'right' }}>Days</span>
        <span style={{ textAlign: 'right' }}>Points</span>
      </div>
      <ol className="pad" style={{ margin: 0, padding: '0 24px', listStyle: 'none' }}>
        {rows.map((row, index) => (
          <li
            key={row.playerId}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 56px 56px',
              gap: 10,
              alignItems: 'center',
              minHeight: 56,
              borderTop: '1px solid rgba(17,17,17,.15)',
              background: row.isViewer ? 'var(--color-chartreuse)' : 'transparent',
              margin: row.isViewer ? '0 -24px' : undefined,
              padding: row.isViewer ? '0 24px' : undefined,
            }}
          >
            <span className="num" style={{ fontSize: 22 }}>
              {index + 1}
            </span>
            <span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {row.displayName}
                {row.isViewer ? (
                  <span className="mono" style={{ fontSize: 9, marginLeft: 6 }}>
                    You
                  </span>
                ) : null}
              </span>
              <span className="mono" style={{ fontSize: 9, opacity: 0.55, display: 'block' }}>
                {row.wins} wins &middot; best {row.bestScore.toLocaleString()}
              </span>
            </span>
            <span className="num" style={{ fontSize: 20, textAlign: 'right' }}>
              {row.daysPlayed}
            </span>
            <span className="num" style={{ fontSize: 24, textAlign: 'right' }}>
              {row.points}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function movementLabel(movement: number | null): string {
  if (movement === null || movement === 0) return '—';
  return movement > 0 ? `▲ ${movement}` : `▼ ${Math.abs(movement)}`;
}
