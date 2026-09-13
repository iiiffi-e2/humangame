'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FitText } from '@/components/FitText';
import { BackLink } from '@/components/ui';
import { EventShell, Target } from '@/features/game-engine/EventShell';
import { GameField } from '@/features/game-engine/GameField';
import { getGame } from '@/features/game-engine/registry';
import { PILLARS, PILLAR_LABEL, type DailyEvent, type Pillar } from '@/features/game-engine/types';
import { track } from '@/lib/analytics';
import { ApiError, apiPost } from '@/lib/client/api';

interface StartPracticeOutput {
  token: string;
  firstScore: number;
  manifest: { id: string; date: string; dayNumber: number; events: DailyEvent[] };
}

interface SubmitPracticeOutput {
  score: { rawMetric: number; normalized: number; points: number; label: string };
  pillar: Pillar;
  gameId: string;
  index: number;
  nextIndex: number | null;
  token: string;
}

interface FinishPracticeOutput {
  thisRun: number;
  firstScore: number;
  events: Array<{ index: number; pillar: Pillar; gameId: string; points: number }>;
}

type Phase =
  | { kind: 'landing'; error?: string }
  | { kind: 'playing' }
  | { kind: 'interstitial'; result: SubmitPracticeOutput }
  | { kind: 'finishing' }
  | { kind: 'compare'; firstScore: number; thisRun: number }
  | { kind: 'error'; locked?: boolean; message?: string };

const INTERSTITIAL_MS = 1400;
const TOKEN_EXPIRED = 'That session expired. Start again.';

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

export function PracticeReplay({ reducedMotion }: { reducedMotion: boolean }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'landing' });
  const [session, setSession] = useState<StartPracticeOutput | null>(null);
  const [index, setIndex] = useState(0);
  const tokenRef = useRef('');
  const eventStartedAt = useRef(0);
  const submitting = useRef(false);
  const starting = useRef(false);
  const finishing = useRef(false);
  const advanced = useRef(false);

  useEffect(() => {
    if (phase.kind !== 'playing' && phase.kind !== 'interstitial') {
      delete document.body.dataset.locked;
      return;
    }
    document.body.dataset.locked = 'true';
    return () => {
      delete document.body.dataset.locked;
    };
  }, [phase.kind]);

  const resetToLanding = useCallback((error?: string) => {
    tokenRef.current = '';
    starting.current = false;
    submitting.current = false;
    finishing.current = false;
    advanced.current = false;
    setSession(null);
    setIndex(0);
    setPhase(error ? { kind: 'landing', error } : { kind: 'landing' });
  }, []);

  const applyError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && (error.status === 401 || error.code === 'BAD_TOKEN')) {
        resetToLanding(TOKEN_EXPIRED);
        return;
      }
      if (error instanceof ApiError && error.code === 'PRACTICE_LOCKED') {
        setPhase({ kind: 'error', locked: true });
        return;
      }
      setPhase({
        kind: 'error',
        message: error instanceof Error ? error.message : 'That did not go through.',
      });
    },
    [resetToLanding],
  );

  const startReplay = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    try {
      const data = await apiPost<StartPracticeOutput>('/api/practice/start', {});
      tokenRef.current = data.token;
      setSession(data);
      setIndex(0);
      track('practice_started', { dayNumber: data.manifest.dayNumber });
      setPhase({ kind: 'playing' });
    } catch (error) {
      applyError(error);
    } finally {
      starting.current = false;
    }
  }, [applyError]);

  const event = session?.manifest.events[index];

  useEffect(() => {
    if (phase.kind !== 'playing' || !event) return;
    eventStartedAt.current = performance.now();
  }, [phase.kind, event, index]);

  const finish = useCallback(async () => {
    if (!session || finishing.current) return;
    finishing.current = true;
    setPhase({ kind: 'finishing' });
    try {
      const done = await apiPost<FinishPracticeOutput>('/api/practice/finish', {
        token: tokenRef.current,
      });
      track('practice_completed', {
        dayNumber: session.manifest.dayNumber,
        firstScore: done.firstScore,
        thisRun: done.thisRun,
      });
      setPhase({ kind: 'compare', firstScore: done.firstScore, thisRun: done.thisRun });
    } catch (error) {
      applyError(error);
    } finally {
      finishing.current = false;
    }
  }, [applyError, session]);

  const submit = useCallback(
    async (result: unknown) => {
      if (!session || !event || submitting.current) return;
      submitting.current = true;
      const durationMs = performance.now() - eventStartedAt.current;
      try {
        const response = await apiPost<SubmitPracticeOutput>('/api/practice/event', {
          token: tokenRef.current,
          index: event.index,
          durationMs,
          result,
        });
        tokenRef.current = response.token;
        setSession((current) => (current ? { ...current, token: response.token } : current));
        advanced.current = false;
        setPhase({ kind: 'interstitial', result: response });
      } catch (error) {
        applyError(error);
      } finally {
        submitting.current = false;
      }
    },
    [applyError, event, session],
  );

  const advance = useCallback(
    (result: SubmitPracticeOutput) => {
      if (advanced.current) return;
      advanced.current = true;
      if (result.nextIndex === null) {
        void finish();
        return;
      }
      setIndex(result.nextIndex);
      setPhase({ kind: 'playing' });
    },
    [finish],
  );

  if (phase.kind === 'landing') {
    return <Landing error={phase.error} onPlay={() => void startReplay()} />;
  }

  if (phase.kind === 'error' && phase.locked) {
    return <LockedPractice />;
  }

  if (phase.kind === 'error') {
    return <ReplayError message={phase.message ?? 'That did not go through.'} onReset={() => resetToLanding()} />;
  }

  if (phase.kind === 'finishing') {
    return <Finishing />;
  }

  if (phase.kind === 'compare') {
    return (
      <Compare firstScore={phase.firstScore} thisRun={phase.thisRun} onReplay={() => resetToLanding()} />
    );
  }

  if (!session || !event) {
    return <Landing onPlay={() => void startReplay()} />;
  }

  if (phase.kind === 'interstitial') {
    return (
      <Interstitial
        result={phase.result}
        total={session.manifest.events.length}
        nextPillar={
          phase.result.nextIndex === null
            ? null
            : (session.manifest.events[phase.result.nextIndex]?.pillar ?? null)
        }
        onAdvance={() => advance(phase.result)}
      />
    );
  }

  if (event.voided) {
    return (
      <VoidedEvent
        event={event}
        total={session.manifest.events.length}
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
      total={session.manifest.events.length}
      instruction={renderInstruction(definition.instruction(event.config))}
      hint={definition.hint?.(event.config)}
      footer="Practice. This one doesn't count."
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

function Landing({ error, onPlay }: { error?: string; onPlay: () => void }) {
  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/" label="Today" />
        <span className="mono">Practice</span>
      </div>
      <div
        className="pad"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        <h1 className="disp" style={{ fontSize: 'min(52px, 13vw)', margin: 0 }}>
          Practice
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.4, marginTop: 16, opacity: 0.8, maxWidth: 320 }}>
          Today&apos;s five again. This run does not count.
        </p>
        {error ? (
          <p
            className="mono"
            role="alert"
            style={{ color: 'var(--color-coral)', marginTop: 16, textTransform: 'none' }}
          >
            {error}
          </p>
        ) : null}
      </div>
      <div className="pad" style={{ paddingBottom: 28 }}>
        <button type="button" className="btn btn-hi" onClick={onPlay} autoFocus>
          <span>Play today&apos;s five again</span>
          <span aria-hidden>&rarr;</span>
        </button>
      </div>
    </main>
  );
}

function LockedPractice() {
  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/" label="Today" />
        <span className="mono">Practice</span>
      </div>
      <div
        className="pad"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
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

function Compare({
  firstScore,
  thisRun,
  onReplay,
}: {
  firstScore: number;
  thisRun: number;
  onReplay: () => void;
}) {
  return (
    <main id="main" className="phone" data-testid="practice-compare">
      <div className="statusbar">
        <BackLink href="/" label="Today" />
        <span className="mono">Practice</span>
      </div>
      <div
        className="pad"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}
      >
        <div>
          <div className="mono" style={{ opacity: 0.6 }}>
            First score
          </div>
          <div className="num" style={{ fontSize: 'min(80px, 20vw)', marginTop: 8 }}>
            {firstScore.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="mono" style={{ opacity: 0.6 }}>
            This run
          </div>
          <div className="num" style={{ fontSize: 'min(80px, 20vw)', marginTop: 8 }}>
            {thisRun.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="pad" style={{ paddingBottom: 28 }}>
        <button type="button" className="btn btn-hi" onClick={onReplay}>
          <span>Play today&apos;s five again</span>
          <span aria-hidden>&rarr;</span>
        </button>
      </div>
    </main>
  );
}

function Finishing() {
  return (
    <main id="main" className="phone dark-surface">
      <div className="statusbar">
        <span>HUMAN</span>
        <span className="mono">Practice</span>
      </div>
      <div
        className="pad"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        <div className="mono" style={{ opacity: 0.5 }}>
          This run
        </div>
        <div className="num" style={{ fontSize: 'min(172px, 42vw)', color: 'var(--color-chartreuse)', marginTop: 12 }}>
          &mdash;,&mdash;&mdash;&mdash;
        </div>
        <div style={{ height: 6, background: 'rgba(244,240,232,.15)', marginTop: 26 }}>
          <div className="anim-bar" style={{ width: '72%', height: '100%', background: 'var(--color-chartreuse)' }} />
        </div>
        <div className="mono" style={{ opacity: 0.4, marginTop: 14 }}>
          Tallying an unofficial score…
        </div>
      </div>
    </main>
  );
}

function ReplayError({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/" label="Today" />
        <span className="mono">Practice</span>
      </div>
      <div
        className="pad"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      >
        <h1 className="disp" style={{ fontSize: 52, margin: 0 }}>
          That did not go through.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.4, marginTop: 18 }}>{message}</p>
      </div>
      <div className="pad" style={{ paddingBottom: 28 }}>
        <button type="button" className="btn btn-hi" onClick={onReset}>
          <span>Play today&apos;s five again</span>
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
  result: SubmitPracticeOutput;
  total: number;
  nextPillar: Pillar | null;
  onAdvance: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onAdvance, INTERSTITIAL_MS);
    return () => clearTimeout(timer);
  }, [onAdvance]);

  const headline = headlineFor(result.score.normalized);
  const metric = metricLabel(result);

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
            {metric}
          </span>
          <span style={{ padding: '6px 0' }}>{result.score.label}</span>
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

function headlineFor(normalized: number): string {
  if (normalized >= 0.995) return 'Perfect.';
  if (normalized >= 0.93) return 'Nailed it.';
  if (normalized >= 0.82) return 'Sharp.';
  if (normalized >= 0.64) return 'Solid.';
  if (normalized >= 0.42) return 'Human.';
  if (normalized >= 0.18) return 'Shaky.';
  return 'Cooked.';
}

function metricLabel(result: SubmitPracticeOutput): string {
  const value = result.score.rawMetric;
  switch (result.gameId) {
    case 'nerve.dead-stop':
      return `${Math.abs(Math.round(value))} ms ${value >= 0 ? 'late' : 'early'}`;
    case 'nerve.grow':
    case 'nerve.crosshair':
      return `${Math.abs(value).toFixed(1)} off`;
    case 'eye.percent':
    case 'eye.half':
      return `${Math.abs(value).toFixed(1)}% off`;
    case 'eye.angle':
      return `${Math.abs(value).toFixed(1)}° off`;
    case 'memory.flash-grid':
      return `${value} right`;
    case 'memory.sequence':
      return `${value} in a row`;
    case 'brain.order':
      return `${value} in place`;
    case 'crowd.split':
      return `${Math.abs(value).toFixed(0)} points out`;
    case 'crowd.majority':
    case 'crowd.avoid':
      return `${value.toFixed(0)}% went there`;
    default:
      return `${(value / 1000).toFixed(2)}s`;
  }
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
          scored on it.
        </p>
      </div>
      <div className="pad" style={{ paddingBottom: 28 }}>
        <button type="button" className="btn" onClick={onContinue}>
          <span>{nextPillar ? `Continue to ${PILLAR_LABEL[nextPillar]}` : 'See this run'}</span>
          <span aria-hidden>&rarr;</span>
        </button>
      </div>
    </main>
  );
}
