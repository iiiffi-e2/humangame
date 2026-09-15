'use client';

import { useCallback, useRef, useState } from 'react';
import type { ErasedGameProps } from '@/features/game-engine/EventShell';
import { useElapsed } from '@/features/game-engine/use-elapsed';
import type { AngleConfig } from './angle';
import type { HalfConfig } from './half';
import type { PercentConfig } from './percent';

/**
 * EYE play fields — visual estimation, committed with LOCK. Percent and Angle
 * have no +/− so the target cannot be counted to; Half keeps nudges because
 * there is no number on the page. Keyboard arrows still work.
 */

export function HalfField({ config, onComplete }: ErasedGameProps) {
  const typed = config as HalfConfig;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [fraction, setFraction] = useState(0.5);
  const [touched, setTouched] = useState(false);
  const elapsed = useElapsed();

  const setFromPointer = useCallback((clientX: number, clientY: number) => {
    const element = trackRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const radians = (typed.angleDeg * Math.PI) / 180;
    // Project the pointer onto the line's own axis.
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const along = dx * Math.cos(radians) + dy * Math.sin(radians);
    const length = rect.width * typed.length;
    setFraction(Math.max(0, Math.min(1, along / length + 0.5)));
    setTouched(true);
  }, [typed.angleDeg, typed.length]);

  return (
    <>
      <div
        ref={trackRef}
        role="application"
        aria-label="Tap the middle of the line"
        onPointerDown={(event) => setFromPointer(event.clientX, event.clientY)}
        onPointerMove={(event) => {
          if (event.buttons > 0) setFromPointer(event.clientX, event.clientY);
        }}
        style={{
          flex: 1,
          margin: '28px 24px 0',
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
      >
        <div
          style={{
            width: `${typed.length * 100}%`,
            height: 6,
            background: 'var(--color-ink)',
            transform: `rotate(${typed.angleDeg}deg)`,
            position: 'relative',
          }}
        >
          {touched ? (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: `${fraction * 100}%`,
                top: -22,
                bottom: -22,
                width: 4,
                marginLeft: -2,
                background: 'var(--color-chartreuse)',
                outline: '2px solid var(--color-ink)',
              }}
            />
          ) : null}
        </div>
      </div>
      <LockBar
        label="Lock it in"
        disabled={!touched}
        onAdjust={(delta) => {
          setTouched(true);
          setFraction((value) => Math.max(0, Math.min(1, value + delta * 0.005)));
        }}
        onLock={() => onComplete({ fraction, elapsedMs: elapsed() })}
      />
    </>
  );
}

export function PercentField({ config, onComplete }: ErasedGameProps) {
  const typed = config as PercentConfig;
  const tankRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState(typed.startPercent);
  const elapsed = useElapsed();

  const setFromPointer = useCallback((clientY: number) => {
    const element = tankRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const next = ((rect.bottom - clientY) / rect.height) * 100;
    setValue(Math.max(0, Math.min(100, Math.round(next * 10) / 10)));
  }, []);

  return (
    <>
      <div
        ref={tankRef}
        role="slider"
        tabIndex={0}
        aria-label={`Fill level, target ${typed.targetPercent} percent`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromPointer(event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons > 0) setFromPointer(event.clientY);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 5 : 1;
          if (event.key === 'ArrowUp') setValue((current) => Math.min(100, current + step));
          if (event.key === 'ArrowDown') setValue((current) => Math.max(0, current - step));
        }}
        style={{
          flex: 1,
          margin: '28px 24px 0',
          position: 'relative',
          border: '2px solid var(--color-ink)',
          overflow: 'hidden',
          touchAction: 'none',
          cursor: 'ns-resize',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${value}%`,
            background: 'var(--color-ink)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: `${value}%`,
            height: 3,
            background: 'var(--color-chartreuse)',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            bottom: `${value}%`,
            transform: 'translate(-50%, 50%)',
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--color-chartreuse)',
            border: '3px solid var(--color-ink)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span
            style={{
              width: 18,
              height: 2,
              background: 'var(--color-ink)',
              boxShadow: '0 5px 0 var(--color-ink), 0 -5px 0 var(--color-ink)',
            }}
          />
        </div>
      </div>
      <LockBar
        label="Lock it in"
        onLock={() => onComplete({ valuePercent: value, elapsedMs: elapsed() })}
      />
    </>
  );
}

export function AngleField({ config, onComplete }: ErasedGameProps) {
  const typed = config as AngleConfig;
  const dialRef = useRef<HTMLDivElement | null>(null);
  const [deg, setDeg] = useState(typed.startDeg);
  const elapsed = useElapsed();

  const setFromPointer = useCallback((clientX: number, clientY: number) => {
    const element = dialRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    // 0 degrees is straight up, increasing clockwise.
    const next = (Math.atan2(dx, -dy) * 180) / Math.PI;
    setDeg(Math.round(((next % 360) + 360) % 360));
  }, []);

  return (
    <>
      <div
        ref={dialRef}
        role="slider"
        tabIndex={0}
        aria-label={`Ray bearing, target ${typed.targetDeg} degrees`}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={deg}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setFromPointer(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons > 0) setFromPointer(event.clientX, event.clientY);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 1;
          if (event.key === 'ArrowRight') setDeg((current) => (current + step) % 360);
          if (event.key === 'ArrowLeft') setDeg((current) => (current - step + 360) % 360);
        }}
        style={{
          flex: 1,
          margin: '28px 24px 0',
          display: 'grid',
          placeItems: 'center',
          touchAction: 'none',
          cursor: 'grab',
        }}
      >
        <div
          style={{
            width: 260,
            height: 260,
            maxWidth: '80vw',
            maxHeight: '80vw',
            borderRadius: '50%',
            border: '2px solid var(--color-ink)',
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              width: 2,
              height: 14,
              marginLeft: -1,
              background: 'var(--color-ink)',
            }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: '50%',
              left: '50%',
              width: 6,
              marginLeft: -3,
              height: '46%',
              background: 'var(--color-ink)',
              transformOrigin: 'bottom center',
              transform: `rotate(${deg}deg)`,
            }}
          />
          <span
            aria-hidden
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--color-ink)',
            }}
          />
        </div>
      </div>
      <LockBar
        label="Lock the angle"
        onLock={() => onComplete({ deg, elapsedMs: elapsed() })}
      />
    </>
  );
}

/**
 * The commit bar. Nudge buttons are optional: Half keeps them so a thumb
 * can land a midpoint. Percent and Angle omit them so the estimate cannot
 * be counted to with +1 taps.
 */
function LockBar({
  label,
  onLock,
  onAdjust,
  disabled = false,
}: {
  label: string;
  onLock: () => void;
  onAdjust?: (delta: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pad" style={{ padding: '16px 24px 28px', display: 'flex', gap: 10 }}>
      {onAdjust ? (
        <>
          <button
            type="button"
            aria-label="Nudge down"
            className="btn btn-ghost"
            style={{ width: 64, minWidth: 64, justifyContent: 'center' }}
            onClick={() => onAdjust(-1)}
          >
            &minus;
          </button>
          <button
            type="button"
            aria-label="Nudge up"
            className="btn btn-ghost"
            style={{ width: 64, minWidth: 64, justifyContent: 'center' }}
            onClick={() => onAdjust(1)}
          >
            +
          </button>
        </>
      ) : null}
      <button type="button" className="btn" onClick={onLock} disabled={disabled}>
        <span>{label}</span>
        <span aria-hidden>&rarr;</span>
      </button>
    </div>
  );
}
