'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FitText } from '@/components/FitText';
import { PillarBar, Spacer } from '@/components/ui';
import type { ResultPayload } from './build';

/**
 * The final reveal — the screen the whole run exists to reach.
 *
 * It plays in two beats: the score counts up alone, then the percentile line
 * and the breakdown slam in behind it. Both beats collapse to nothing when
 * the player has asked for reduced motion, and the settled state is the same
 * markup either way, so nothing is hidden behind an animation that might not
 * run.
 */
export function FinalReveal({
  payload,
  animate,
  reducedMotion,
}: {
  payload: ResultPayload;
  animate: boolean;
  reducedMotion: boolean;
}) {
  const skip = reducedMotion || !animate;
  const [settled, setSettled] = useState(skip);
  const score = useCountUp(payload.totalScore, skip);

  useEffect(() => {
    if (skip) return;
    const timer = setTimeout(() => setSettled(true), 1400);
    return () => clearTimeout(timer);
  }, [skip]);

  const bestPillar = [...payload.pillars].sort((a, b) => b.points - a.points)[0]?.pillar;

  if (!settled) {
    return (
      <main id="main" className="phone dark-surface">
        <div className="statusbar">
          <span>HUMAN #{payload.dayNumber}</span>
          <span>Official</span>
        </div>
        <div
          className="pad"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
        >
          <div className="mono" style={{ opacity: 0.5 }}>
            Your score
          </div>
          <FitText
            className="num"
            max={172}
            style={{ color: 'var(--color-chartreuse)', marginTop: 12 }}
          >
            <span aria-live="polite">{score.toLocaleString()}</span>
          </FitText>
          <div style={{ height: 6, background: 'rgba(244,240,232,.15)', marginTop: 26 }}>
            <div
              style={{
                width: `${Math.min(100, (score / Math.max(1, payload.totalScore)) * 100)}%`,
                height: '100%',
                background: 'var(--color-chartreuse)',
              }}
            />
          </div>
          <div className="mono" style={{ opacity: 0.4, marginTop: 14 }}>
            Ranking against {payload.populationSize.toLocaleString()}…
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="phone dark-surface">
      <div className="statusbar">
        <span>HUMAN #{payload.dayNumber}</span>
        <span>Official</span>
      </div>

      <div className="pad" style={{ paddingTop: 12 }}>
        <FitText className="num anim-slam" max={150} style={{ color: 'var(--color-chartreuse)' }}>
          {payload.totalScore.toLocaleString()}
        </FitText>
        <div className="mono" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ background: 'var(--color-chartreuse)', color: 'var(--color-ink)', padding: '4px 8px' }}>
            {payload.tier}
          </span>
          <span style={{ opacity: 0.6 }}>
            Top {payload.topPercent}% &middot; {payload.populationSize.toLocaleString()} played
          </span>
        </div>
      </div>

      <div className="pad" style={{ paddingTop: 22 }}>
        <h1 className="disp" style={{ fontSize: 'min(44px, 11vw)', margin: 0 }}>
          You beat <span style={{ color: 'var(--color-chartreuse)' }}>{Math.round(payload.percentile)}%</span> of
          humans today.
        </h1>
        {payload.provisional ? (
          <p className="mono" style={{ opacity: 0.55, marginTop: 10, textTransform: 'none', letterSpacing: '0.02em' }}>
            Provisional. Percentile settles as more humans finish — your score is final.
          </p>
        ) : null}
      </div>

      <div className="pad" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {payload.pillars.map((row) => (
          <PillarBar
            key={row.pillar}
            pillar={row.pillar}
            value={row.value}
            best={row.pillar === bestPillar}
            onDark
          />
        ))}
      </div>

      {payload.voidedPillars.length > 0 ? (
        <p className="pad mono" style={{ marginTop: 14, color: 'var(--color-coral)', textTransform: 'none' }}>
          {payload.voidedPillars.join(', ').toUpperCase()} was voided for everyone. Your run is still
          ranked out of 10,000.
        </p>
      ) : null}

      <div
        className="pad"
        style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: payload.rival ? '1fr 1fr' : '1fr',
          borderTop: '1px solid rgba(244,240,232,.25)',
          borderBottom: '1px solid rgba(244,240,232,.25)',
        }}
      >
        <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="num" style={{ fontSize: 34 }}>
            {payload.streak}
          </span>
          <span className="mono">day streak</span>
        </div>
        {payload.rival ? (
          <Link
            href={`/rivalry/${payload.rival.playerId}`}
            style={{
              padding: '12px 0 12px 14px',
              borderLeft: '1px solid rgba(244,240,232,.25)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-cobalt-soft)' }}>
              {rivalLine(payload.rival)}
            </div>
            <div className="mono" style={{ opacity: 0.6, fontSize: 10, marginTop: 3 }}>
              Season {payload.rival.seasonWinsViewer}&ndash;{payload.rival.seasonWinsRival}
            </div>
          </Link>
        ) : null}
      </div>

      <Spacer />

      <div className="pad" style={{ paddingBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link
          href={`/result/${payload.runId}/share`}
          className="btn btn-hi"
          style={{ minHeight: 72, fontSize: 22, textDecoration: 'none' }}
        >
          <span>Challenge a friend</span>
          <span aria-hidden>&#8599;</span>
        </Link>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Link href="/leaderboards" className="btn btn-ghost on-dark" style={{ textDecoration: 'none' }}>
            <span>Leaderboards</span>
          </Link>
          <Link href="/practice" className="btn btn-ghost on-dark" style={{ textDecoration: 'none' }}>
            <span>Practice</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

function rivalLine(rival: NonNullable<ResultPayload['rival']>): string {
  if (!rival.played || rival.delta === null) return `${rival.displayName} hasn't played yet`;
  if (rival.delta === 0) return `Dead level with ${rival.displayName}`;
  return rival.delta > 0
    ? `You got ${rival.displayName} by ${rival.delta.toLocaleString()}`
    : `${rival.displayName} got you by ${Math.abs(rival.delta).toLocaleString()}`;
}

/**
 * Mechanical count-up. Eases out so the last few hundred points land slowly,
 * which is the part people screenshot.
 */
function useCountUp(target: number, skip: boolean): number {
  const [value, setValue] = useState(skip ? target : 0);

  useEffect(() => {
    // When motion is off the state already starts at the target; there is
    // nothing to animate and nothing to set.
    if (skip) return;
    const duration = 1200;
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (performance.now() - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [skip, target]);

  return value;
}
