'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ErasedGameProps } from '@/features/game-engine/EventShell';
import { useElapsed } from '@/features/game-engine/use-elapsed';
import type { NextConfig, NextTile } from './next';
import type { OrderConfig } from './order';
import type { RotateConfig, RotateShape } from './rotate';

/** BRAIN play fields: reasoning under mild time pressure, never a reflex test. */

export function OrderField({ config, onComplete }: ErasedGameProps) {
  const typed = config as OrderConfig;
  const [items, setItems] = useState(typed.items);
  const [held, setHeld] = useState<string | null>(null);
  const elapsed = useElapsed();

  const move = (id: string, direction: -1 | 1) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(target, 0, moved);
      return next;
    });
  };

  return (
    <>
      <ol
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 10,
          padding: '0 24px',
          margin: 0,
          listStyle: 'none',
        }}
      >
        {items.map((item, index) => {
          const active = held === item.id;
          return (
            <li
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 64,
                padding: '0 8px 0 16px',
                border: '2px solid var(--color-ink)',
                background: active ? 'var(--color-chartreuse)' : 'transparent',
                boxShadow: active ? '0 8px 0 var(--color-ink)' : 'none',
                transform: active ? 'translateY(-4px)' : 'none',
              }}
            >
              <span className="mono" style={{ opacity: 0.5, width: 14 }}>
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => setHeld(active ? null : item.id)}
                aria-pressed={active}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  border: 0,
                  background: 'transparent',
                  fontWeight: 700,
                  fontSize: 20,
                  color: 'inherit',
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                {item.label}
              </button>
              <button
                type="button"
                aria-label={`Move ${item.label} up`}
                disabled={index === 0}
                onClick={() => move(item.id, -1)}
                className="tap"
                style={arrowStyle}
              >
                &uarr;
              </button>
              <button
                type="button"
                aria-label={`Move ${item.label} down`}
                disabled={index === items.length - 1}
                onClick={() => move(item.id, 1)}
                className="tap"
                style={arrowStyle}
              >
                &darr;
              </button>
            </li>
          );
        })}
      </ol>
      <div className="pad" style={{ padding: '16px 24px 28px' }}>
        <button
          type="button"
          className="btn"
          onClick={() => onComplete({ order: items.map((item) => item.id), elapsedMs: elapsed() })}
        >
          <span>Lock order</span>
          <span aria-hidden>&rarr;</span>
        </button>
      </div>
    </>
  );
}

const arrowStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  border: 0,
  background: 'transparent',
  fontSize: 18,
  color: 'inherit',
  cursor: 'pointer',
  justifyContent: 'center',
};

function TileGlyph({ tile, size = 62 }: { tile: NextTile; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 2,
        border: '2px solid currentColor',
        padding: 3,
      }}
    >
      {Array.from({ length: 9 }, (_, cell) => (
        <span
          key={cell}
          style={{ background: tile.cells.includes(cell) ? 'currentColor' : 'transparent' }}
        />
      ))}
    </span>
  );
}

export function NextField({ config, onComplete }: ErasedGameProps) {
  const typed = config as NextConfig;
  const startRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    startRef.current = performance.now();
  }, []);

  const pick = useCallback(
    (id: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete({ pickedId: id, elapsedMs: performance.now() - startRef.current });
    },
    [onComplete],
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 32,
        padding: '0 24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {typed.sequence.map((tile) => (
          <TileGlyph key={tile.id} tile={tile} />
        ))}
        <span className="num" style={{ fontSize: 40, opacity: 0.35 }} aria-hidden>
          ?
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {typed.options.map((tile, index) => (
          <button
            key={tile.id}
            type="button"
            aria-label={`Option ${index + 1}`}
            onClick={() => pick(tile.id)}
            style={{
              border: '2px solid var(--color-ink)',
              background: 'transparent',
              padding: 16,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              minHeight: 96,
              color: 'inherit',
            }}
          >
            <TileGlyph tile={tile} size={54} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ShapeGlyph({ shape, size = 92 }: { shape: RotateShape; size?: number }) {
  const points = shape.points
    .map(([x, y]) => `${(x * 45 + 50).toFixed(2)},${(y * 45 + 50).toFixed(2)}`)
    .join(' ');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden focusable="false">
      <polygon points={points} fill="currentColor" />
    </svg>
  );
}

export function RotateField({ config, onComplete }: ErasedGameProps) {
  const typed = config as RotateConfig;
  const startRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    startRef.current = performance.now();
  }, []);

  const pick = useCallback(
    (id: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete({ pickedId: id, elapsedMs: performance.now() - startRef.current });
    },
    [onComplete],
  );

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 24,
        padding: '0 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '2px solid currentColor',
          paddingBottom: 16,
        }}
      >
        <ShapeGlyph shape={typed.prompt} size={110} />
        <span className="mono" style={{ opacity: 0.6, textTransform: 'none' }}>
          This shape,
          <br />
          turned.
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {typed.options.map((shape, index) => (
          <button
            key={shape.id}
            type="button"
            aria-label={`Option ${index + 1}`}
            onClick={() => pick(shape.id)}
            style={{
              border: '2px solid var(--color-ink)',
              background: 'transparent',
              padding: 10,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            <ShapeGlyph shape={shape} />
          </button>
        ))}
      </div>
    </div>
  );
}
