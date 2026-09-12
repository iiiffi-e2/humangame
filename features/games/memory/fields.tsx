'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ErasedGameProps } from '@/features/game-engine/EventShell';
import type { FlashGridConfig } from './flash-grid';
import type { SequenceConfig, SequenceIcon } from './sequence';
import type { WhatMovedConfig } from './what-moved';

/**
 * MEMORY play fields. Each one runs a short scripted phase (show, hide,
 * recall) and only then accepts input, so the instruction is always readable
 * before anything is being measured.
 */

type Phase = 'ready' | 'show' | 'recall';

function ReadyGate({ label, onStart }: { label: string; onStart: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <button
        type="button"
        className="btn btn-hi"
        style={{ width: 220, justifyContent: 'center' }}
        onClick={onStart}
      >
        Ready
      </button>
      <p className="mono" style={{ opacity: 0.6, textTransform: 'none' }}>
        {label}
      </p>
    </div>
  );
}

export function FlashGridField({ config, onComplete }: ErasedGameProps) {
  const typed = config as FlashGridConfig;
  const [phase, setPhase] = useState<Phase>('ready');
  const [picked, setPicked] = useState<number[]>([]);
  const doneRef = useRef(false);

  useEffect(() => {
    if (phase !== 'show') return;
    const timer = setTimeout(() => setPhase('recall'), typed.flashMs);
    return () => clearTimeout(timer);
  }, [phase, typed.flashMs]);

  const toggle = (cell: number) => {
    if (phase !== 'recall' || doneRef.current) return;
    setPicked((current) => {
      if (current.includes(cell)) return current.filter((entry) => entry !== cell);
      const next = [...current, cell];
      if (next.length >= typed.cells.length) {
        doneRef.current = true;
        // Let the last tile paint before the interstitial takes over.
        setTimeout(() => onComplete({ picked: next }), 140);
      }
      return next;
    });
  };

  if (phase === 'ready') {
    return <ReadyGate label="The tiles flash once." onStart={() => setPhase('show')} />;
  }

  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '0 16px' }}>
      <div
        role="group"
        aria-label={`Grid of ${typed.size} by ${typed.size} tiles`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${typed.size}, 1fr)`,
          gap: 8,
          width: 'min(340px, 88vw)',
        }}
      >
        {Array.from({ length: typed.size * typed.size }, (_, cell) => {
          const lit = phase === 'show' && typed.cells.includes(cell);
          const chosen = picked.includes(cell);
          return (
            <button
              key={cell}
              type="button"
              aria-label={`Tile ${cell + 1}${chosen ? ', selected' : ''}`}
              aria-pressed={chosen}
              disabled={phase !== 'recall'}
              onClick={() => toggle(cell)}
              style={{
                aspectRatio: '1',
                border: '2px solid var(--color-ink)',
                background: lit || chosen ? 'var(--color-ink)' : 'transparent',
                cursor: phase === 'recall' ? 'pointer' : 'default',
                position: 'relative',
              }}
            >
              {chosen ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 6,
                    border: '2px solid var(--color-chartreuse)',
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WhatMovedField({ config, onComplete }: ErasedGameProps) {
  const typed = config as WhatMovedConfig;
  const [phase, setPhase] = useState<Phase>('ready');
  const startRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (phase !== 'show') return;
    const timer = setTimeout(() => {
      setPhase('recall');
      startRef.current = performance.now();
    }, typed.previewMs);
    return () => clearTimeout(timer);
  }, [phase, typed.previewMs]);

  const pick = useCallback(
    (id: string) => {
      if (phase !== 'recall' || doneRef.current) return;
      doneRef.current = true;
      onComplete({ pickedId: id, elapsedMs: performance.now() - startRef.current });
    },
    [onComplete, phase],
  );

  if (phase === 'ready') {
    return <ReadyGate label="Study the field, then spot the change." onStart={() => setPhase('show')} />;
  }

  return (
    <div
      style={{
        flex: 1,
        margin: '24px 24px 0',
        position: 'relative',
        border: '2px solid var(--color-ink)',
      }}
    >
      {typed.items.map((item) => {
        const shifted = phase === 'recall' && item.id === typed.movedId;
        const x = item.x + (shifted ? typed.shift.dx : 0);
        const y = item.y + (shifted ? typed.shift.dy : 0);
        return (
          <button
            key={item.id}
            type="button"
            aria-label={`Item at ${Math.round(x * 100)} across, ${Math.round(y * 100)} down`}
            disabled={phase !== 'recall'}
            onClick={() => pick(item.id)}
            style={{
              position: 'absolute',
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 44,
              height: 44,
              border: 0,
              background: 'transparent',
              display: 'grid',
              placeItems: 'center',
              cursor: phase === 'recall' ? 'pointer' : 'default',
              padding: 0,
            }}
          >
            <Shape kind={item.shape} />
          </button>
        );
      })}
    </div>
  );
}

function Shape({ kind }: { kind: WhatMovedConfig['items'][number]['shape'] }) {
  const base: React.CSSProperties = { background: 'var(--color-ink)', display: 'block' };
  if (kind === 'circle') return <span style={{ ...base, width: 22, height: 22, borderRadius: '50%' }} />;
  if (kind === 'bar') return <span style={{ ...base, width: 28, height: 8 }} />;
  if (kind === 'triangle') {
    return (
      <span
        style={{
          width: 0,
          height: 0,
          borderLeft: '12px solid transparent',
          borderRight: '12px solid transparent',
          borderBottom: '22px solid var(--color-ink)',
          display: 'block',
        }}
      />
    );
  }
  return <span style={{ ...base, width: 22, height: 22 }} />;
}

const ICON_GLYPH: Record<SequenceIcon, string> = {
  bolt: '⚡',
  moon: '☽',
  eye: '◉',
  wave: '≈',
  ring: '○',
  cross: '×',
};

export function SequenceField({ config, onComplete }: ErasedGameProps) {
  const typed = config as SequenceConfig;
  const [phase, setPhase] = useState<Phase>('ready');
  // Playback starts at the first icon; the glyph is only rendered while the
  // phase is 'show', so no sentinel value is needed.
  const [step, setStep] = useState(0);
  const [entered, setEntered] = useState<string[]>([]);
  const doneRef = useRef(false);

  useEffect(() => {
    if (phase !== 'show') return;
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      if (index >= typed.sequence.length) {
        clearInterval(timer);
        setPhase('recall');
        return;
      }
      setStep(index);
    }, typed.stepMs);
    return () => clearInterval(timer);
  }, [phase, typed.sequence.length, typed.stepMs]);

  if (phase === 'ready') {
    return <ReadyGate label="Watch once, then play it back." onStart={() => setPhase('show')} />;
  }

  const press = (icon: SequenceIcon) => {
    if (phase !== 'recall' || doneRef.current) return;
    const next = [...entered, icon];
    setEntered(next);
    if (next.length >= typed.sequence.length) {
      doneRef.current = true;
      setTimeout(() => onComplete({ entered: next }), 140);
    }
  };

  const current = typed.sequence[step] ?? null;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
      }}
    >
      <div style={{ height: 120, display: 'grid', placeItems: 'center' }}>
        {phase === 'show' ? (
          <span style={{ fontSize: 96, lineHeight: 1 }} aria-hidden>
            {current ? ICON_GLYPH[current] : ''}
          </span>
        ) : (
          <span className="num" style={{ fontSize: 56 }}>
            {entered.length}
            <span style={{ opacity: 0.3 }}>/{typed.sequence.length}</span>
          </span>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(3, typed.keypad.length)}, 1fr)`,
          gap: 10,
          width: 'min(330px, 86vw)',
        }}
      >
        {typed.keypad.map((icon) => (
          <button
            key={icon}
            type="button"
            aria-label={icon}
            disabled={phase !== 'recall'}
            onClick={() => press(icon)}
            style={{
              aspectRatio: '1',
              border: '2px solid currentColor',
              background: 'transparent',
              fontSize: 34,
              color: 'inherit',
              opacity: phase === 'recall' ? 1 : 0.25,
              cursor: phase === 'recall' ? 'pointer' : 'default',
            }}
          >
            {ICON_GLYPH[icon]}
          </button>
        ))}
      </div>
    </div>
  );
}
