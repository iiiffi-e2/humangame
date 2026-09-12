'use client';

import { useCallback, useState } from 'react';
import { BackLink } from '@/components/ui';
import { EventShell } from '@/features/game-engine/EventShell';
import { GameField } from '@/features/game-engine/GameField';
import { getGame } from '@/features/game-engine/registry';
import { PILLAR_LABEL, type DailyEvent, type Pillar } from '@/features/game-engine/types';
import { track } from '@/lib/analytics';
import { apiPost } from '@/lib/client/api';

interface Family {
  id: string;
  name: string;
  pillar: Pillar;
}

interface ScoreResponse {
  score: { points: number; label: string; rawMetric: number; normalized: number };
}

/** Pick a family, play one round, see the score, go again. Nothing is recorded. */
export function PracticeBoard({
  families,
  reducedMotion,
}: {
  families: Family[];
  reducedMotion: boolean;
}) {
  const [event, setEvent] = useState<DailyEvent | null>(null);
  const [result, setResult] = useState<ScoreResponse['score'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (gameId: string) => {
    setError(null);
    setResult(null);
    try {
      const response = await apiPost<{ event: DailyEvent }>('/api/practice/start', { gameId });
      track('practice_started', { gameId });
      setEvent(response.event);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start that.');
    }
  }, []);

  const submit = useCallback(
    async (payload: unknown) => {
      if (!event) return;
      try {
        const response = await apiPost<ScoreResponse>('/api/practice/score', {
          gameId: event.gameId,
          seed: event.seed,
          difficulty: event.difficulty,
          result: payload,
        });
        setResult(response.score);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not score that.');
      }
    },
    [event],
  );

  if (event && !result) {
    const definition = getGame(event.gameId);
    return (
      <EventShell
        pillar={event.pillar}
        gameId={event.gameId}
        gameName={`${definition.name} · practice`}
        index={0}
        total={1}
        instruction={definition.instruction(event.config)}
        hint={definition.hint?.(event.config)}
        footer="Practice. Nothing here is recorded."
      >
        <GameField
          gameId={event.gameId}
          config={event.config}
          onComplete={submit}
          reducedMotion={reducedMotion}
        />
      </EventShell>
    );
  }

  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/" label="Today" />
        <span className="mono">Practice</span>
      </div>

      <div className="pad" style={{ paddingTop: 8 }}>
        <h1 className="disp" style={{ fontSize: 'min(52px, 13vw)', margin: 0 }}>
          Practice
        </h1>
        <p className="mono" style={{ marginTop: 12, opacity: 0.6, textTransform: 'none', letterSpacing: '0.02em' }}>
          Random seeds. No leaderboard, no streak, no record.
        </p>
      </div>

      {result ? (
        <div
          className="pad"
          style={{ margin: '20px 24px 0', padding: 16, background: 'var(--color-chartreuse)' }}
        >
          <div className="num" style={{ fontSize: 56 }}>
            {result.points.toLocaleString()}
            <span style={{ fontSize: 24, opacity: 0.5 }}> / 2,000</span>
          </div>
          <div className="mono" style={{ marginTop: 8 }}>
            {result.label}
          </div>
          <button
            type="button"
            className="btn"
            style={{ marginTop: 14 }}
            onClick={() => (event ? start(event.gameId) : undefined)}
          >
            <span>Again</span>
            <span aria-hidden>&rarr;</span>
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="pad mono" role="alert" style={{ color: 'var(--color-coral)', paddingTop: 14, textTransform: 'none' }}>
          {error}
        </p>
      ) : null}

      <ul className="pad" style={{ margin: '20px 0 28px', padding: '0 24px', listStyle: 'none' }}>
        {families.map((family) => (
          <li key={family.id} style={{ borderTop: '1px solid rgba(17,17,17,.15)' }}>
            <button
              type="button"
              onClick={() => start(family.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                minHeight: 56,
                border: 0,
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'left',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 17 }}>{family.name}</span>
              <span className="mono" style={{ opacity: 0.6 }}>
                {PILLAR_LABEL[family.pillar]} &rsaquo;
              </span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
