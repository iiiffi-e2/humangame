import { ImageResponse } from 'next/og';
import { topPercent } from '@/features/results/percentile';
import { CARD_COLORS, CARD_SIZES } from '@/features/challenges/card';
import { getStore } from '@/lib/db';
import { pillarPercent } from '@/lib/scoring';

export const runtime = 'nodejs';

/**
 * The 1200x630 card a challenge link unfurls into.
 *
 * Scores and percentiles only — a share card must never leak the day's
 * configs, and it must read at thumbnail size, so the number is the picture.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const store = getStore();
  const link = await store.getChallenge(token);
  const run = link ? await store.getRun(link.runId) : null;
  const player = link ? await store.getPlayer(link.playerId) : null;

  const score = run?.totalScore ?? 0;
  const percentile = run?.percentile ?? 50;
  const dayNumber = run?.dayNumber ?? 0;
  const name = player?.displayName ?? 'Someone';
  const { width, height } = CARD_SIZES.og;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: CARD_COLORS.ink,
          color: CARD_COLORS.bone,
          padding: 56,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -2 }}>HUMAN</span>
          <span style={{ fontSize: 24, letterSpacing: 2 }}>#{dayNumber}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 28, letterSpacing: 3 }}>{name.toUpperCase()} PUT UP</span>
          <span style={{ fontSize: 190, fontWeight: 900, color: CARD_COLORS.chartreuse, lineHeight: 1 }}>
            {score.toLocaleString()}
          </span>
          <span style={{ fontSize: 34, marginTop: 8 }}>
            Top {topPercent(percentile)}% · beat {Math.round(percentile)}% of humans
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {(run?.events ?? []).map((event) => (
            <div
              key={event.index}
              style={{
                display: 'flex',
                flex: 1,
                height: 14,
                background: 'rgba(244,240,232,0.15)',
              }}
            >
              <div
                style={{
                  width: `${pillarPercent(event.points)}%`,
                  background: CARD_COLORS.bone,
                }}
              />
            </div>
          ))}
        </div>

        <span style={{ fontSize: 30, fontWeight: 700 }}>Can you beat me? Five tests, 75 seconds.</span>
      </div>
    ),
    { width, height },
  );
}
