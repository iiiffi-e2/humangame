import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CrewInvite } from '@/features/crews/CrewInvite';
import { BackLink } from '@/components/ui';
import { requirePlayer } from '@/lib/auth/session';
import { getCrewView } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Crew ${slug}` };
}

/**
 * One crew. Today's board and the month's board, with everybody's score
 * sealed until the viewer has played — the point of a crew is that the
 * pressure runs both ways.
 */
export default async function CrewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const player = await requirePlayer();
  const { slug } = await params;
  const { view: viewParam } = await searchParams;
  const view = await getCrewView(player, slug);
  if (!view) notFound();

  const monthly = viewParam === 'month';

  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/crews" label="Crews" />
        <CrewInvite code={view.crew.inviteCode} slug={view.crew.slug} />
      </div>

      <div className="pad" style={{ paddingTop: 8 }}>
        <div className="mono" style={{ opacity: 0.6 }}>
          Crew
        </div>
        <h1 className="disp" style={{ fontSize: 'min(64px, 16vw)', letterSpacing: '-0.05em', margin: 0 }}>
          {view.crew.name}
        </h1>
        <div className="mono" style={{ marginTop: 8 }}>
          {view.members.length} members &middot; code {view.crew.inviteCode}
        </div>
      </div>

      <div
        className="pad"
        style={{
          marginTop: 24,
          padding: 16,
          border: '2px solid var(--color-ink)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginLeft: 24,
          marginRight: 24,
        }}
      >
        <div>
          <div className="num" style={{ fontSize: 44 }}>
            {view.playedToday}
            <span style={{ opacity: 0.3 }}>/{view.members.length}</span>
          </div>
          <div className="mono" style={{ marginTop: 4 }}>
            played today
          </div>
        </div>
        <div style={{ display: 'flex' }} aria-hidden>
          {view.members
            .filter((member) => member.played)
            .slice(0, 4)
            .map((member, index) => (
              <span
                key={member.playerId}
                style={{
                  width: 32,
                  height: 32,
                  background: 'var(--color-ink)',
                  color: 'var(--color-bone)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: 13,
                  marginLeft: index === 0 ? 0 : -6,
                  outline: index === 0 ? 'none' : '2px solid var(--color-bone)',
                }}
              >
                {member.displayName[0]?.toUpperCase()}
              </span>
            ))}
        </div>
      </div>

      {!view.viewerHasPlayed ? (
        <Link
          href="/play"
          className="pad"
          style={{
            margin: '12px 24px 0',
            padding: 14,
            background: 'var(--color-ink)',
            color: 'var(--color-bone)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textDecoration: 'none',
          }}
        >
          <span>
            <span style={{ fontWeight: 700, fontSize: 15, display: 'block' }}>
              Scores sealed until you play.
            </span>
            <span className="mono" style={{ opacity: 0.6, fontSize: 10, marginTop: 3, display: 'block' }}>
              Your run &middot; ~75 sec
            </span>
          </span>
          <span className="mono" style={{ background: 'var(--color-chartreuse)', color: 'var(--color-ink)', padding: '8px 10px' }}>
            Play
          </span>
        </Link>
      ) : null}

      <nav
        className="pad mono"
        aria-label="Crew standings range"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          margin: '24px 24px 0',
          padding: 0,
          borderBottom: '2px solid var(--color-ink)',
        }}
      >
        {[
          ['today', 'Today'],
          ['month', 'This month'],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/crew/${view.crew.slug}?view=${key}`}
            aria-current={(key === 'month') === monthly ? 'page' : undefined}
            style={{
              padding: '10px 0',
              textAlign: 'center',
              textDecoration: 'none',
              background: (key === 'month') === monthly ? 'var(--color-ink)' : 'transparent',
              color: (key === 'month') === monthly ? 'var(--color-bone)' : 'inherit',
            }}
          >
            {label}
          </Link>
        ))}
      </nav>

      <ol className="pad" style={{ margin: 0, padding: '0 24px', listStyle: 'none' }}>
        {monthly
          ? view.monthly.map((standing, index) => (
              <li
                key={standing.playerId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 80px',
                  gap: 10,
                  alignItems: 'center',
                  minHeight: 52,
                  borderTop: '1px solid rgba(17,17,17,.15)',
                }}
              >
                <span className="num" style={{ fontSize: 20 }}>
                  {index + 1}
                </span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {standing.displayName}
                  <span className="mono" style={{ opacity: 0.5, fontSize: 9, display: 'block' }}>
                    {standing.daysPlayed} days &middot; {standing.wins} wins
                  </span>
                </span>
                <span className="num" style={{ fontSize: 22, textAlign: 'right' }}>
                  {standing.points}
                </span>
              </li>
            ))
          : view.members.map((member, index) => (
              <li
                key={member.playerId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 90px',
                  gap: 10,
                  alignItems: 'center',
                  minHeight: 52,
                  borderTop: '1px solid rgba(17,17,17,.15)',
                  opacity: member.played ? 1 : 0.45,
                }}
              >
                <span className="num" style={{ fontSize: 20 }}>
                  {member.played ? index + 1 : '—'}
                </span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {member.displayName}
                  {member.isViewer ? ' · you' : ''}
                </span>
                <span
                  className="mono"
                  style={{ textAlign: 'right', opacity: member.score === null ? 0.5 : 1, letterSpacing: member.score === null ? '0.2em' : undefined }}
                >
                  {member.played ? (member.score?.toLocaleString() ?? '●●●●●') : 'Not yet'}
                </span>
              </li>
            ))}
      </ol>

      <div style={{ flex: 1, minHeight: 24 }} />

      <div className="pad" style={{ paddingBottom: 28 }}>
        <p className="mono" style={{ opacity: 0.55, textTransform: 'none', letterSpacing: '0.02em', lineHeight: 1.5 }}>
          Month points: 1st 10 · 2nd 8 · 3rd 6 · 4th 5 · 5th 4 · everyone else who played 2.
        </p>
      </div>
    </main>
  );
}
