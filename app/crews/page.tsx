import Link from 'next/link';
import { DesktopNav } from '@/components/Chrome';
import { CrewForms } from '@/features/crews/CrewForms';
import { BackLink } from '@/components/ui';
import { requirePlayer } from '@/lib/auth/session';
import { currentDateKey, msUntilReset } from '@/lib/daily/reset';
import { ensureManifest } from '@/lib/daily/service';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Crews' };

export default async function CrewsPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const player = await requirePlayer();
  const { code } = await searchParams;
  const store = getStore();
  const crews = await store.listCrewsForPlayer(player.id);
  const manifest = await ensureManifest(currentDateKey());

  const summaries = await Promise.all(
    crews.map(async (crew) => {
      const members = await store.listCrewMembers(crew.id);
      const runs = await store.listRunsForPlayers(
        members.map((member) => member.playerId),
        manifest.id,
      );
      return {
        crew,
        size: members.length,
        played: runs.filter((run) => run.status === 'finished').length,
      };
    }),
  );

  return (
    <>
      <DesktopNav
        dayNumber={manifest.dayNumber}
        date={manifest.date}
        resetInMs={msUntilReset()}
        displayName={player.displayName}
        active="crews"
      />
      <main id="main" className="phone">
        <div className="statusbar">
          <BackLink href="/" label="Today" />
          <span className="mono">Crews</span>
        </div>

        <div className="pad" style={{ paddingTop: 8 }}>
          <h1 className="disp" style={{ fontSize: 'min(52px, 13vw)', margin: 0 }}>
            Your crews
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.4, marginTop: 12, opacity: 0.75, maxWidth: 320 }}>
            Private by invite. Daily standings, monthly placement points, nobody you did not ask for.
          </p>
        </div>

        <ul className="pad" style={{ margin: '20px 0 0', padding: '0 24px', listStyle: 'none' }}>
          {summaries.map(({ crew, size, played }) => (
            <li key={crew.id} style={{ borderTop: '1px solid rgba(17,17,17,.15)' }}>
              <Link
                href={`/crew/${crew.slug}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: 64,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span>
                  <span className="disp" style={{ fontSize: 26, display: 'block' }}>
                    {crew.name}
                  </span>
                  <span className="mono" style={{ opacity: 0.6, fontSize: 10 }}>
                    {size} members &middot; code {crew.inviteCode}
                  </span>
                </span>
                <span className="num" style={{ fontSize: 26 }}>
                  {played}
                  <span style={{ opacity: 0.3 }}>/{size}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {summaries.length === 0 ? (
          <p className="pad" style={{ paddingTop: 20, fontSize: 15, opacity: 0.7 }}>
            You are not in a crew yet.
          </p>
        ) : null}

        <div style={{ flex: 1, minHeight: 24 }} />
        <CrewForms initialCode={code ?? ''} />
      </main>
    </>
  );
}
