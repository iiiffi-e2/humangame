import { notFound } from 'next/navigation';
import { RivalryActions } from '@/features/rivalries/RivalryActions';
import { BackLink } from '@/components/ui';
import { requirePlayer } from '@/lib/auth/session';
import { formatCountdown } from '@/lib/daily/reset';
import { getRivalryView } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Rivalry' };

/**
 * One head-to-head. Season record on top, the long record underneath, and a
 * fourteen-day calendar that makes a losing streak impossible to ignore.
 */
export default async function RivalryPage({ params }: { params: Promise<{ id: string }> }) {
  const player = await requirePlayer();
  const { id } = await params;
  const view = await getRivalryView(player, id);
  if (!view) notFound();

  const { record } = view;
  const recent = record.outcomes.slice(-14);
  const delta =
    view.todayViewer !== null && view.todayRival !== null
      ? view.todayViewer - view.todayRival
      : null;

  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/leaderboards" label="Back" />
        <span className="mono">Rivalry</span>
      </div>

      <div
        className="pad"
        style={{ paddingTop: 8, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'end', gap: 12 }}
      >
        <div>
          <div
            style={{
              width: 56,
              height: 56,
              background: 'var(--color-ink)',
              color: 'var(--color-chartreuse)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 24,
            }}
            aria-hidden
          >
            {player.displayName[0]?.toUpperCase()}
          </div>
          <div className="disp" style={{ fontSize: 'min(40px, 10vw)', marginTop: 10 }}>
            {player.displayName}
          </div>
        </div>
        <div className="mono" style={{ paddingBottom: 10, opacity: 0.5 }}>
          vs
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: 'var(--color-cobalt)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: 24,
              marginLeft: 'auto',
            }}
            aria-hidden
          >
            {view.rival.displayName[0]?.toUpperCase()}
          </div>
          <div className="disp" style={{ fontSize: 'min(40px, 10vw)', marginTop: 10, color: 'var(--color-cobalt)' }}>
            {view.rival.displayName}
          </div>
        </div>
      </div>

      <div
        className="pad"
        style={{ marginTop: 22, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 14 }}
      >
        <span className="num" style={{ fontSize: 'min(110px, 26vw)' }}>
          {record.seasonWinsA}
        </span>
        <span className="num" style={{ fontSize: 40, opacity: 0.3 }}>
          &ndash;
        </span>
        <span className="num" style={{ fontSize: 'min(110px, 26vw)', color: 'var(--color-cobalt)' }}>
          {record.seasonWinsB}
        </span>
      </div>
      <div className="mono" style={{ textAlign: 'center', opacity: 0.6 }}>
        Season &middot; this month
      </div>

      <div
        className="pad"
        style={{
          marginTop: 22,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderTop: '1px solid var(--color-ink)',
          borderBottom: '1px solid var(--color-ink)',
        }}
      >
        <div style={{ padding: '12px 0' }}>
          <div className="mono" style={{ opacity: 0.6 }}>
            All-time
          </div>
          <div className="num" style={{ fontSize: 26, marginTop: 6 }}>
            {record.allTimeWinsA}&ndash;{record.allTimeWinsB}
          </div>
        </div>
        <div style={{ padding: '12px 0 12px 12px', borderLeft: '1px solid var(--color-ink)' }}>
          <div className="mono" style={{ opacity: 0.6 }}>
            Streak
          </div>
          <div
            className="num"
            style={{
              fontSize: 26,
              marginTop: 6,
              color: record.streakHolder === 'b' ? 'var(--color-cobalt)' : undefined,
            }}
          >
            {record.streakHolder
              ? `${(record.streakHolder === 'a' ? player.displayName : view.rival.displayName)[0]?.toUpperCase()} ×${record.currentStreak}`
              : '—'}
          </div>
        </div>
        <div style={{ padding: '12px 0 12px 12px', borderLeft: '1px solid var(--color-ink)' }}>
          <div className="mono" style={{ opacity: 0.6 }}>
            Avg margin
          </div>
          <div className="num" style={{ fontSize: 26, marginTop: 6 }}>
            {record.averageMargin}
          </div>
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 20 }}>
        <div className="mono" style={{ opacity: 0.6, marginBottom: 10 }}>
          Last 14 days
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 4 }}>
          {Array.from({ length: 14 }, (_, index) => {
            const outcome = recent[index - (14 - recent.length)];
            const winner = outcome?.winner ?? 'none';
            return (
              <div
                key={index}
                title={outcome ? `${outcome.date}: ${winner}` : 'No run'}
                style={{
                  height: 36,
                  background:
                    winner === 'a'
                      ? 'var(--color-ink)'
                      : winner === 'b'
                        ? 'var(--color-cobalt)'
                        : 'transparent',
                  border: winner === 'none' || winner === 'tie' ? '1px solid var(--color-ink)' : 'none',
                  opacity: winner === 'none' ? 0.3 : 1,
                }}
              />
            );
          })}
        </div>
        <div
          className="mono"
          style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, opacity: 0.6 }}
        >
          <span>
            ■ {player.displayName} &nbsp; <span style={{ color: 'var(--color-cobalt)' }}>■</span>{' '}
            {view.rival.displayName} &nbsp; □ missed
          </span>
          <span>Today</span>
        </div>
      </div>

      <div
        className="pad"
        style={{
          marginTop: 20,
        }}
      >
        <div
          style={{
            padding: 14,
            background: delta !== null && delta < 0 ? 'var(--color-cobalt)' : 'var(--color-ink)',
            color: '#fff',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15 }}>{todayLine(view, delta)}</div>
          <div className="mono" style={{ opacity: 0.8, fontSize: 10, marginTop: 3 }}>
            {view.todayViewer !== null && view.todayRival !== null
              ? `${view.todayViewer.toLocaleString()} vs ${view.todayRival.toLocaleString()} · `
              : ''}
            Tomorrow resets in {formatCountdown(view.resetInMs)}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 20 }} />

      <RivalryActions
        rivalId={view.rival.id}
        rivalName={view.rival.displayName}
        isActive={view.isActive}
        isNemesis={view.isNemesis}
      />
    </main>
  );
}

function todayLine(
  view: { todayViewer: number | null; todayRival: number | null; rival: { displayName: string } },
  delta: number | null,
): string {
  if (view.todayViewer === null) return 'Play today to settle it.';
  if (view.todayRival === null) return `${view.rival.displayName} hasn't finished today.`;
  if (delta === null || delta === 0) return 'Dead level today.';
  return delta > 0
    ? `You got ${view.rival.displayName} by ${delta.toLocaleString()} today.`
    : `${view.rival.displayName} got you by ${Math.abs(delta).toLocaleString()} today.`;
}
