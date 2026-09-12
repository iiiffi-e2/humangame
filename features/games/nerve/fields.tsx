'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ErasedGameProps } from '@/features/game-engine/EventShell';
import type { CrosshairConfig } from './crosshair';
import { barPosition } from './crosshair';
import type { DeadStopConfig } from './dead-stop';
import type { GrowConfig } from './grow';

/**
 * NERVE play fields. All three are hold-and-release or tap-at-the-right-
 * moment, so they share one rule: the clock that matters is
 * `performance.now()` inside this component. Nothing is timed across the
 * network.
 */

const FIELD: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 28,
  touchAction: 'none',
  userSelect: 'none',
};

/** Space and Enter behave like a press, so the whole run is playable by keyboard. */
function useHoldKeys(onDown: () => void, onUp: () => void) {
  useEffect(() => {
    let held = false;
    const isHoldKey = (event: KeyboardEvent) => event.code === 'Space' || event.code === 'Enter';
    const down = (event: KeyboardEvent) => {
      if (!isHoldKey(event) || event.repeat || held) return;
      event.preventDefault();
      held = true;
      onDown();
    };
    const up = (event: KeyboardEvent) => {
      if (!isHoldKey(event) || !held) return;
      event.preventDefault();
      held = false;
      onUp();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onDown, onUp]);
}

export function DeadStopField({ config, onComplete }: ErasedGameProps) {
  const typed = config as DeadStopConfig;
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [holding, setHolding] = useState(false);

  const press = useCallback(() => {
    if (doneRef.current || startRef.current !== null) return;
    startRef.current = performance.now();
    setHolding(true);
  }, []);

  const release = useCallback(() => {
    const start = startRef.current;
    if (doneRef.current || start === null) return;
    doneRef.current = true;
    setHolding(false);
    onComplete({ heldMs: performance.now() - start });
  }, [onComplete]);

  useHoldKeys(press, release);

  return (
    <div style={FIELD}>
      <div className="num" style={{ fontSize: 112, opacity: holding ? 0.12 : 1 }} aria-hidden>
        {holding ? '—.——' : (typed.targetMs / 1000).toFixed(2)}
      </div>
      <button
        type="button"
        aria-label={`Hold for ${(typed.targetMs / 1000).toFixed(2)} seconds, then release`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        style={{
          width: 260,
          height: 260,
          maxWidth: '80vw',
          maxHeight: '80vw',
          borderRadius: '50%',
          border: 0,
          background: holding ? 'var(--color-chartreuse)' : 'var(--color-ink)',
          color: holding ? 'var(--color-ink)' : 'var(--color-chartreuse)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: holding ? 'none' : '0 10px 0 var(--color-gray)',
          transform: holding ? 'scale(.96)' : 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{ textAlign: 'center' }}>
          <span className="disp" style={{ fontSize: 28, display: 'block' }}>
            {holding ? 'Holding' : 'Hold'}
          </span>
          {!holding ? (
            <span className="mono" style={{ opacity: 0.7, marginTop: 6, display: 'block' }}>
              press &amp; release
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}

export function CrosshairField({ config, onComplete, reducedMotion }: ErasedGameProps) {
  const typed = config as CrosshairConfig;
  const startRef = useRef<number>(0);
  const doneRef = useRef(false);
  const [armed, setArmed] = useState(false);
  const [positions, setPositions] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!armed) return;
    startRef.current = performance.now();
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      setPositions({
        x: barPosition(elapsed, typed.periodXMs, typed.phaseX),
        y: barPosition(elapsed, typed.periodYMs, typed.phaseY),
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [armed, typed.periodXMs, typed.periodYMs, typed.phaseX, typed.phaseY]);

  const fire = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete({ tapMs: performance.now() - startRef.current });
  }, [onComplete]);

  if (!armed) {
    return (
      <div style={FIELD}>
        <button type="button" className="btn btn-hi" style={{ width: 220, justifyContent: 'center' }} onClick={() => setArmed(true)}>
          Ready
        </button>
        <p className="mono" style={{ opacity: 0.6, textTransform: 'none' }}>
          The bars start moving when you are.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={fire}
      aria-label="Tap when the two bars cross"
      style={{
        ...FIELD,
        margin: '28px 24px 0',
        border: '2px solid var(--color-ink)',
        position: 'relative',
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: `${positions.x * 100}%`,
          top: 0,
          bottom: 0,
          width: 6,
          marginLeft: -3,
          background: 'var(--color-ink)',
          transition: reducedMotion ? 'none' : undefined,
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: `${positions.y * 100}%`,
          top: 0,
          bottom: 0,
          width: 6,
          marginLeft: -3,
          background: 'var(--color-cobalt)',
          mixBlendMode: 'multiply',
        }}
      />
      <span className="mono" style={{ position: 'absolute', bottom: 12, opacity: 0.5 }}>
        tap to fire
      </span>
    </button>
  );
}

export function GrowField({ config, onComplete }: ErasedGameProps) {
  const typed = config as GrowConfig;
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [size, setSize] = useState(typed.startSize);

  const press = useCallback(() => {
    if (doneRef.current || startRef.current !== null) return;
    startRef.current = performance.now();
  }, []);

  const release = useCallback(() => {
    const start = startRef.current;
    if (doneRef.current || start === null) return;
    doneRef.current = true;
    onComplete({ releaseMs: performance.now() - start });
  }, [onComplete]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (startRef.current !== null && !doneRef.current) {
        const elapsed = performance.now() - startRef.current;
        setSize(typed.startSize + (typed.growthPerSecond * elapsed) / 1000);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [typed.growthPerSecond, typed.startSize]);

  useHoldKeys(press, release);

  const box = 280;
  return (
    <div style={FIELD}>
      <button
        type="button"
        aria-label="Hold to grow the shape, release when it fills the ring"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        style={{
          width: box,
          height: box,
          maxWidth: '84vw',
          maxHeight: '84vw',
          border: 0,
          background: 'transparent',
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            width: `${typed.targetSize * 100}%`,
            height: `${typed.targetSize * 100}%`,
            borderRadius: '50%',
            border: '3px dashed var(--color-gray)',
          }}
        />
        <span
          aria-hidden
          style={{
            width: `${Math.min(1.4, size) * 100}%`,
            height: `${Math.min(1.4, size) * 100}%`,
            borderRadius: '50%',
            background: 'var(--color-ink)',
          }}
        />
      </button>
      <span className="mono" style={{ opacity: 0.55 }}>
        hold &amp; release
      </span>
    </div>
  );
}
