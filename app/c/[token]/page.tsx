import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChallengeTracker } from '@/features/challenges/ChallengeTracker';
import { FitText } from '@/components/FitText';
import { Avatar, Wordmark } from '@/components/ui';
import { requirePlayer } from '@/lib/auth/session';
import { formatStamp } from '@/lib/daily/reset';
import { getChallengeView } from '@/lib/queries';
import { publicEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    title: 'Beat this score',
    openGraph: {
      title: 'Can you beat me?',
      description: 'Five events. One official run. Everyone gets the same five.',
      images: [{ url: `/api/og/${token}`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', images: [`${publicEnv.siteUrl}/api/og/${token}`] },
  };
}

/**
 * Challenge landing.
 *
 * The recipient sees the score they have to beat and nothing else — no event
 * list, no configs, no hint about what the five are. They still get exactly
 * one official run, same as everybody.
 */
export default async function ChallengePage({ params }: { params: Promise<{ token: string }> }) {
  const player = await requirePlayer();
  const { token } = await params;
  const view = await getChallengeView(player, token);
  if (!view) notFound();

  const beaten = view.viewerScore !== null ? view.viewerScore - view.score : null;

  return (
    <main id="main" className="phone dark-surface">
      <ChallengeTracker token={view.token} dayNumber={view.dayNumber} margin={beaten} />

      <div className="statusbar">
        <span>
          #{view.dayNumber} &middot; {formatStamp(view.date)}
        </span>
        <span className="mono" style={{ color: 'var(--color-cobalt-soft)' }}>
          Challenge from {view.challengerName}
        </span>
      </div>

      <div
        className="pad"
        style={{ paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Wordmark />
      </div>

      <div className="pad" style={{ paddingTop: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <Avatar name={view.challengerName} size={44} tone="cobalt" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{view.challengerName}</div>
            <div className="mono" style={{ opacity: 0.6, fontSize: 10 }}>
              {view.playedAgo}
            </div>
          </div>
        </div>

        <div className="disp" style={{ fontSize: 'min(52px, 13vw)' }}>
          {view.challengerName} put up
        </div>
        <FitText
          className="num anim-slam"
          max={132}
          style={{ color: 'var(--color-chartreuse)', margin: '8px 0 6px' }}
        >
          {view.score.toLocaleString()}
        </FitText>
        <div className="disp" style={{ fontSize: 'min(52px, 13vw)' }}>
          Top {view.topPercent}% {view.isToday ? 'today' : `on #${view.dayNumber}`}.
        </div>

        {beaten === null ? (
          <p style={{ margin: '22px 0 0', fontSize: 17, lineHeight: 1.35, opacity: 0.85 }}>
            You get one official run.
            <br />
            Same five events. Answers stay sealed.
          </p>
        ) : (
          <div
            style={{
              marginTop: 24,
              padding: 16,
              background: beaten >= 0 ? 'var(--color-chartreuse)' : 'var(--color-cobalt)',
              color: beaten >= 0 ? 'var(--color-ink)' : '#fff',
            }}
          >
            <div className="disp" style={{ fontSize: 28 }}>
              {beaten > 0
                ? `You win by ${beaten.toLocaleString()}.`
                : beaten === 0
                  ? 'Dead level.'
                  : `${view.challengerName} wins by ${Math.abs(beaten).toLocaleString()}.`}
            </div>
            <div className="mono" style={{ marginTop: 6 }}>
              {view.viewerScore?.toLocaleString()} vs {view.score.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 20 }} />

      <div
        className="pad mono"
        style={{ paddingBottom: 12, display: 'flex', justifyContent: 'space-between' }}
      >
        <span style={{ opacity: 0.6 }}>No account needed</span>
        <span style={{ opacity: 0.6 }}>{view.provisional ? 'Percentile settling' : 'Settled'}</span>
      </div>

      <div
        className="pad"
        style={{ paddingBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {view.viewerHasPlayed ? (
          <>
            <Link
              href={`/rivalry/${view.challengerId}`}
              className="btn btn-hi"
              style={{ minHeight: 72, fontSize: 22, textDecoration: 'none' }}
            >
              <span>Make {view.challengerName} a rival</span>
              <span aria-hidden>&rarr;</span>
            </Link>
            <Link href={`/result/${view.viewerRunId}`} className="btn btn-ghost on-dark" style={{ textDecoration: 'none' }}>
              <span>Your result</span>
              <span aria-hidden>&rarr;</span>
            </Link>
          </>
        ) : (
          <>
            <Link
              href={`/play?c=${view.token}`}
              className="btn btn-hi"
              style={{ minHeight: 72, fontSize: 22, textDecoration: 'none' }}
            >
              <span>Beat {view.challengerName}</span>
              <span className="mono" style={{ fontSize: 12 }}>
                ~75 sec &rarr;
              </span>
            </Link>
            <Link href="/" className="btn btn-ghost on-dark" style={{ textDecoration: 'none' }}>
              <span>Just play today&rsquo;s five</span>
              <span aria-hidden>&rarr;</span>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
