'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EventShell, Target } from './EventShell';
import { GameField } from './GameField';
import { getGame } from './registry';
import { PILLARS, type DailyEvent, type Pillar } from './types';
import { PILLAR_LABEL } from './types';
import { FitText } from '@/components/FitText';
import { track } from '@/lib/analytics';
import { apiPost } from '@/lib/client/api';
import { headlineFor, type ScoreResult } from '@/lib/scoring';
import { eventChips } from '@/features/results/event-copy';

/**
 * Drives one official run from start to reveal.
 *
 * The shell owns progress, timing and submission; each family owns only its
 * field. Progress is mirrored into localStorage so an accidental navigation
 * mid-run comes back to the right event rather than a lost day — the server
 * is the authority on how far the run actually got, and the local copy is
 * only a hint.
 */

interface StartResponse {
  token: string;
  runId: string;
  resumed: boolean;
  completedEvents: number;
  manifest: { id: string; date: string; dayNumber: number; events: DailyEvent[] };
}

interface EventResponse {
  score: ScoreResult;
  pillar: Pillar;
  gameId: string;
  index: number;
  nextIndex: number | null;
  runId: string;
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; alreadyPlayed: boolean }
  | { kind: 'intro' }
  | { kind: 'playing' }
  | { kind: 'interstitial'; result: EventResponse }
  | { kind: 'finishing' };

const INTERSTITIAL_MS = 1400;

function storageKey(date: string): string {
  return `human:run:${date}`;
}

/** Highlight the first number in an instruction, the way the design does. */
function renderInstruction(text: string): React.ReactNode {
  const match = /\d[\d.,]*\s?%?/.exec(text);
  if (!match) return text;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  return (
    <>
      {before}
      <Target>{match[0].trim()}</Target>
      {after}
    </>
  );
}

export function RunShell({
  challengeToken,
  reducedMotion,
}: {
  challengeToken: string | null;
  reducedMotion: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [start, setStart] = useState<StartResponse | null>(null);
  const [index, setIndex] = useState(0);
  const eventStartedAt = useRef<number>(0);
  const submitting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    apiPost<StartResponse>('/api/run/start', { challengeToken })
      .then((data) => {
        if (cancelled) return;
        setStart(data);
        setIndex(Math.min(data.completedEvents, data.manifest.events.length - 1));
        setPhase(data.completedEvents > 0 ? { kind: 'playing' } : { kind: 'intro' });
        if (data.completedEvents === 0) {
          track('daily_started', {
            dayNumber: data.manifest.dayNumber,
            fromChallenge: Boolean(challengeToken),
          });
        }
      })
      .catch((error: Error & { code?: string }) => {
        if (cancelled) return;
        setPhase({
          kind: 'error',
          message: error.message,
          alreadyPlayed: error.code === 'ALREADY_PLAYED',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [challengeToken]);

  useEffect(() => {
    document.body.dataset.locked = 'true';
    return () => {
      delete document.body.dataset.locked;
    };
  }, []);

  const event = start?.manifest.events[index];

  useEffect(() => {
    if (phase.kind !== 'playing' || !event || !start) return;
    eventStartedAt.current = performance.now();
    window.localStorage.setItem(
      storageKey(start.manifest.date),
      JSON.stringify({ runId: start.runId, index }),
    );
    track('event_started', {
      dayNumber: start.manifest.dayNumber,
      index: event.index,
      pillar: event.pillar,
      gameId: event.gameId,
    });
  }, [phase.kind, event, index, start]);

  const finish = useCallback(async () => {
    if (!start) return;
    setPhase({ kind: 'finishing' });
    try {
      const result = await apiPost<{ resultId: string; totalScore: number; percentile: number; streak: number }>(
        '/api/run/finish',
        { token: start.token },
      );
      window.localStorage.removeItem(storageKey(start.manifest.date));
      track('daily_completed', {
        dayNumber: start.manifest.dayNumber,
        totalScore: result.totalScore,
        percentile: result.percentile,
        streak: result.streak,
      });
      router.replace(`/result/${result.resultId}?reveal=1`);
    } catch (error) {
      setPhase({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not finish the run.',
        alreadyPlayed: false,
      });
    }
  }, [router, start]);

  const submit = useCallback(
    async (result: unknown) => {
      if (!start || !event || submitting.current) return;
      submitting.current = true;
      const durationMs = performance.now() - eventStartedAt.current;
      try {
        const response = await apiPost<EventResponse>('/api/run/event', {
          token: start.token,
          index: event.index,
          durationMs,
          result,
        });
        track('event_completed', {
          dayNumber: start.manifest.dayNumber,
          index: response.index,
          pillar: response.pillar,
          gameId: response.gameId,
          points: response.score.points,
          durationMs: Math.round(durationMs),
        });
        setPhase({ kind: 'interstitial', result: response });
      } catch (error) {
        setPhase({
          kind: 'error',
          message: error instanceof Error ? error.message : 'That did not go through.',
          alreadyPlayed: false,
        });
      } finally {
        submitting.current = false;
      }
    },
    [event, start],
  );

  const advance = useCallback(
    (result: EventResponse) => {
      if (result.nextIndex === null) {
        void finish();
        return;
      }
      setIndex(result.nextIndex);
      setPhase({ kind: 'playing' });
    },
    [finish],
  );

  if (phase.kind === 'loading') return <LoadingRun />;
  if (phase.kind === 'error') return <RunError phase={phase} />;
  if (phase.kind === 'finishing') return <Ranking />;
  if (!start || !event) return <LoadingRun />;

  if (phase.kind === 'intro') {
    return <RunIntro onStart={() => setPhase({ kind: 'playing' })} />;
  }

  if (phase.kind === 'interstitial') {
    return (
      <Interstitial
        result={phase.result}
        total={start.manifest.events.length}
        nextPillar={
          phase.result.nextIndex === null
            ? null
            : (start.manifest.events[phase.result.nextIndex]?.pillar ?? null)
        }
        onAdvance={() => advance(phase.result)}
      />
    );
  }

  if (event.voided) {
    return (
      <VoidedEvent
        event={event}
        total={start.manifest.events.length}
        onContinue={() => void submit(null)}
      />
    );
  }

  const definition = getGame(event.gameId);

  return (
    <EventShell
      pillar={event.pillar}
      gameId={event.gameId}
      gameName={definition.name}
      index={event.index}
      total={start.manifest.events.length}
      instruction={renderInstruction(definition.instruction(event.config))}
      hint={definition.hint?.(event.config)}
      footer={event.pillar === 'crowd' ? 'Predict them, not yourself.' : 'Starts on your first move'}
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

/* ------------------------------------------------------------------ */
/* Framing screens                                                     */
/* ------------------------------------------------------------------ */

function RunIntro({ onStart }: { onStart: () => void }) {
  return (
    <main id="main" className="phone dark-surface">
      <div className="statusbar">
        <span>HUMAN</span>
        <span className="mono">Official run</span>
      </div>
      <div
        className="pad"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        <h1 className="disp" style={{ fontSize: 'min(76px, 19vw)', margin: 0 }}>
          This one counts.
        </h1>
        <p style={{ margin: '22px 0 0', fontSize: 17, lineHeight: 1.4, opacity: 0.8, maxWidth: 320 }}>
          Once an event starts, the result is official. Each test begins on your tap.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
            marginTop: 48,
          }}
        >
          {PILLARS.map((pillar, position) => (
            <div key={pillar} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  height: 6,
                  background: 'var(--color-bone)',
                  opacity: position === 0 ? 1 : 0.35,
                }}
              />
              <span className="mono" style={{ fontSize: 9, opacity: position === 0 ? 1 : 0.5 }}>
                {PILLAR_LABEL[pillar]}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="pad" style={{ paddingBottom: 28 }}>
        <button
          type="button"
          className="btn btn-hi"
          style={{ minHeight: 72, fontSize: 22 }}
          onClick={onStart}
          autoFocus
        >
          <span>Start run</span>
          <span aria-hidden>&rarr;</span>
        </button>
      </div>
    </main>
  );
}

function Interstitial({
  result,
  total,
  nextPillar,
  onAdvance,
}: {
  result: EventResponse;
  total: number;
  nextPillar: Pillar | null;
  onAdvance: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onAdvance, INTERSTITIAL_MS);
    return () => clearTimeout(timer);
  }, [onAdvance]);

  const headline = headlineFor(result.score.normalized);
  const chips = eventChips(result.gameId, result.score);

  return (
    <main
      id="main"
      className="phone"
      data-testid="interstitial"
      style={{ background: 'var(--color-chartreuse)', cursor: 'pointer' }}
      onClick={onAdvance}
      role="button"
      tabIndex={0}
      onKeyDown={(keyEvent) => {
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') onAdvance();
      }}
      aria-label="Tap to continue"
    >
      <div className="statusbar">
        <span className="mono">
          {PILLAR_LABEL[result.pillar]} &middot; {getGame(result.gameId).name}
        </span>
        <span className="mono">
          {result.index + 1} / {total}
        </span>
      </div>
      <div
        className="pad anim-slam"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        <FitText className="disp" max={72}>
          {headline}
        </FitText>
        <div style={{ marginTop: 28 }}>
          <FitText className="num" max={120}>
            {result.score.points.toLocaleString()}
            <span style={{ fontSize: '0.33em', opacity: 0.5, marginLeft: '0.12em' }}>/ 2,000</span>
          </FitText>
        </div>
        <div className="mono" style={{ marginTop: 24, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ background: 'var(--color-ink)', color: 'var(--color-chartreuse)', padding: '6px 10px' }}>
            {chips.primary}
          </span>
          <span style={{ padding: '6px 0' }}>{chips.secondary}</span>
        </div>
      </div>
      <div
        className="pad mono"
        style={{ paddingBottom: 28, display: 'flex', justifyContent: 'space-between' }}
      >
        <span style={{ opacity: 0.6 }}>
          {nextPillar ? `Next: ${PILLAR_LABEL[nextPillar]}` : 'Last one done'}
        </span>
        <span>Tap to continue &rarr;</span>
      </div>
      <div
        aria-hidden
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgba(17,17,17,.2)' }}
      >
        <div
          style={{
            width: `${((result.index + 1) / total) * 100}%`,
            height: '100%',
            background: 'var(--color-ink)',
          }}
        />
      </div>
    </main>
  );
}

function LoadingRun() {
  return (
    <main id="main" className="phone dark-surface">
      <div className="statusbar">
        <span className="mono" style={{ opacity: 0.5 }}>
          Loading run
        </span>
        <span className="mono" style={{ opacity: 0.5 }}>
          Official
        </span>
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <span className="num" style={{ fontSize: 96, opacity: 0.25 }}>
          HUMAN
        </span>
      </div>
      <div className="pad" style={{ paddingBottom: 28 }}>
        <div style={{ height: 4, background: 'rgba(244,240,232,.15)' }}>
          <div style={{ width: '35%', height: '100%', background: 'var(--color-chartreuse)' }} />
        </div>
        <p className="mono" style={{ fontSize: 9, opacity: 0.5, marginTop: 8 }}>
          Fetching today&rsquo;s five…
        </p>
      </div>
    </main>
  );
}

function Ranking() {
  return (
    <main id="main" className="phone dark-surface">
      <div className="statusbar">
        <span>HUMAN</span>
        <span className="mono">Official</span>
      </div>
      <div
        className="pad"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        <div className="mono" style={{ opacity: 0.5 }}>
          Your score
        </div>
        <div className="num" style={{ fontSize: 'min(172px, 42vw)', color: 'var(--color-chartreuse)', marginTop: 12 }}>
          &mdash;,&mdash;&mdash;&mdash;
        </div>
        <div style={{ height: 6, background: 'rgba(244,240,232,.15)', marginTop: 26 }}>
          <div className="anim-bar" style={{ width: '72%', height: '100%', background: 'var(--color-chartreuse)' }} />
        </div>
        <div className="mono" style={{ opacity: 0.4, marginTop: 14 }}>
          Ranking you against today…
        </div>
      </div>
    </main>
  );
}

function RunError({ phase }: { phase: { message: string; alreadyPlayed: boolean } }) {
  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <span>HUMAN</span>
        <span className="mono">{phase.alreadyPlayed ? 'Already played' : 'Problem'}</span>
      </div>
      <div
        className="pad"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        <h1 className="disp" style={{ fontSize: 52, margin: 0 }}>
          {phase.alreadyPlayed ? 'One run a day.' : 'That did not go through.'}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.4, marginTop: 18 }}>{phase.message}</p>
      </div>
      <div className="pad" style={{ paddingBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link className="btn btn-hi" href="/" style={{ textDecoration: 'none' }}>
          <span>Back to today</span>
          <span aria-hidden>&rarr;</span>
        </Link>
        <Link className="btn btn-ghost" href="/leaderboards" style={{ textDecoration: 'none' }}>
          <span>Leaderboards</span>
        </Link>
      </div>
    </main>
  );
}

function VoidedEvent({
  event,
  total,
  onContinue,
}: {
  event: DailyEvent;
  total: number;
  onContinue: () => void;
}) {
  const nextPillar = PILLARS[event.index + 1];
  return (
    <main id="main" className="phone" style={{ background: 'var(--color-coral)' }}>
      <div className="statusbar">
        <span className="mono">{PILLAR_LABEL[event.pillar]}</span>
        <span className="mono">
          {event.index + 1} / {total}
        </span>
      </div>
      <div
        className="pad"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        <span
          className="mono"
          style={{ background: 'var(--color-ink)', color: 'var(--color-coral)', padding: '6px 10px', width: 'max-content' }}
        >
          Event voided
        </span>
        <h1 className="disp" style={{ fontSize: 'min(64px, 16vw)', marginTop: 20 }}>
          This one didn&rsquo;t count.
        </h1>
        <p style={{ margin: '20px 0 0', fontSize: 16, lineHeight: 1.4, maxWidth: 320, textWrap: 'pretty' }}>
          A defect made today&rsquo;s {PILLAR_LABEL[event.pillar].toUpperCase()} event unfair. Nobody is
          scored on it, and your run is still ranked out of <strong>10,000</strong>.
        </p>
      </div>
      <div className="pad" style={{ paddingBottom: 28 }}>
        <button type="button" className="btn" onClick={onContinue}>
          <span>{nextPillar ? `Continue to ${PILLAR_LABEL[nextPillar]}` : 'See your score'}</span>
          <span aria-hidden>&rarr;</span>
        </button>
      </div>
    </main>
  );
}
