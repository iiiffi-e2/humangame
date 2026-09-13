import Link from 'next/link';
import { BackLink } from '@/components/ui';
import { PracticeReplay } from '@/features/practice/PracticeReplay';
import { requirePlayer } from '@/lib/auth/session';
import { currentDateKey } from '@/lib/daily/reset';
import { ensureManifest } from '@/lib/daily/service';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Practice' };

/**
 * Practice unlocks only after the official run. It replays today's five
 * and writes nothing — no leaderboard, no streak, no stats.
 */
export default async function PracticePage() {
  const player = await requirePlayer();
  const manifest = await ensureManifest(currentDateKey());
  const run = await getStore().getOfficialRun(player.id, manifest.id);
  const unlocked = run?.status === 'finished';

  if (!unlocked) {
    return (
      <main id="main" className="phone">
        <div className="statusbar">
          <BackLink href="/" label="Today" />
          <span className="mono">Practice</span>
        </div>
        <div className="pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 className="disp" style={{ fontSize: 'min(52px, 13vw)', margin: 0 }}>
            Today first.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.4, marginTop: 16, opacity: 0.8, maxWidth: 320 }}>
            Practice opens once your official run is in. Nobody gets to warm up on the day that counts.
          </p>
          <Link href="/play" className="btn btn-hi" style={{ marginTop: 28, textDecoration: 'none' }}>
            <span>Play today</span>
            <span className="mono" style={{ fontSize: 12 }}>
              ~75 sec &rarr;
            </span>
          </Link>
        </div>
      </main>
    );
  }

  return <PracticeReplay reducedMotion={player.settings.reduceMotion} />;
}
