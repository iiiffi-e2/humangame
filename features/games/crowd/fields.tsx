'use client';

import { useState } from 'react';
import type { ErasedGameProps } from '@/features/game-engine/EventShell';
import { useElapsed } from '@/features/game-engine/use-elapsed';
import type { AvoidConfig } from './avoid';
import type { MajorityConfig } from './majority';
import type { SplitConfig } from './split';

/**
 * CROWD play fields. The question itself is the instruction, so these fields
 * carry no text of their own beyond the options.
 */

function OptionList({
  options,
  onPick,
  hint,
}: {
  options: Array<{ id: string; label: string }>;
  onPick: (id: string, elapsedMs: number) => void;
  hint: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const elapsed = useElapsed();
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 10,
        padding: '0 24px',
      }}
    >
      {options.map((option) => {
        const active = picked === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (picked) return;
              setPicked(option.id);
              setTimeout(() => onPick(option.id, elapsed()), 130);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 68,
              padding: '0 18px',
              border: '2px solid var(--color-ink)',
              background: active ? 'var(--color-chartreuse)' : 'transparent',
              fontWeight: 700,
              fontSize: 20,
              color: 'inherit',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span>{option.label}</span>
            <span className="mono" style={{ opacity: 0.45 }} aria-hidden>
              {active ? 'locked' : hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MajorityField({ config, onComplete }: ErasedGameProps) {
  const typed = config as MajorityConfig;
  return (
    <OptionList
      options={typed.options}
      hint="pick"
      onPick={(id, elapsedMs) => onComplete({ pickedId: id, elapsedMs })}
    />
  );
}

export function AvoidField({ config, onComplete }: ErasedGameProps) {
  const typed = config as AvoidConfig;
  return (
    <OptionList
      options={typed.options}
      hint="alone?"
      onPick={(id, elapsedMs) => onComplete({ pickedId: id, elapsedMs })}
    />
  );
}

export function SplitField({ config, onComplete }: ErasedGameProps) {
  const typed = config as SplitConfig;
  const [value, setValue] = useState(50);
  const elapsed = useElapsed();

  return (
    <>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="num" style={{ fontSize: 'min(168px, 40vw)' }}>
          {value}
          <span
            style={{
              fontSize: '0.36em',
              fontStretch: '100%',
              verticalAlign: 'top',
              display: 'inline-block',
              marginTop: '0.12em',
            }}
          >
            %
          </span>
        </div>
        <div className="mono" style={{ opacity: 0.6, marginTop: 6 }}>
          choose {typed.subjectA}
        </div>
      </div>

      <div className="pad" style={{ paddingBottom: 8 }}>
        <label className="sr-only" htmlFor="split-dial">
          Percentage of players choosing {typed.subjectA}
        </label>
        <input
          id="split-dial"
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          style={{ width: '100%', height: 44, accentColor: 'var(--color-ink)' }}
        />
        <div
          className="mono"
          style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, opacity: 0.6 }}
        >
          <span>0 &middot; nobody</span>
          <span>everyone &middot; 100</span>
        </div>
      </div>

      <div className="pad" style={{ padding: '16px 24px 28px' }}>
        <button type="button" className="btn" onClick={() => onComplete({ predicted: value, elapsedMs: elapsed() })}>
          <span>Call it</span>
          <span aria-hidden>&rarr;</span>
        </button>
      </div>
    </>
  );
}
