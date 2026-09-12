'use client';

import type { Pillar } from './types';
import { PILLAR_LABEL } from './types';
import { ProgressPips } from '@/components/ui';

/**
 * The reusable event shell.
 *
 * Owns everything that is the same for all fifteen families — category, run
 * progress, the one line of instruction, the footer note — and hands the
 * family nothing but a full-bleed play field. Games never draw chrome, and
 * the shell never knows what a game is.
 *
 * The instruction is rendered *before* any timed interaction starts, and the
 * families that are time-sensitive gate themselves behind a press, so there
 * is always a chance to read it.
 */
export function EventShell({
  pillar,
  gameId,
  gameName,
  index,
  total,
  instruction,
  hint,
  footer,
  dark = false,
  accent,
  children,
  headerExtra,
}: {
  pillar: Pillar;
  /** Family id, surfaced as a data attribute so tests can drive the field. */
  gameId: string;
  gameName: string;
  index: number;
  total: number;
  instruction: React.ReactNode;
  hint?: React.ReactNode;
  footer?: React.ReactNode;
  dark?: boolean;
  accent?: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  return (
    <main
      id="main"
      className={`phone${dark ? ' dark-surface' : ''}`}
      style={accent ? { background: accent } : undefined}
      data-testid="event-shell"
      data-game={gameId}
      data-pillar={pillar}
      data-index={index}
    >
      <div className="statusbar">
        <span className="mono">
          {PILLAR_LABEL[pillar]} &middot; {gameName}
        </span>
        <span className="mono" aria-label={`Event ${index + 1} of ${total}`}>
          {index + 1} / {total}
        </span>
      </div>

      <ProgressPips total={total} current={index} onDark={dark} />

      <div
        className="pad"
        style={{
          paddingTop: 36,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
        }}
      >
        <div>
          <h1
            className="disp"
            style={{
              fontSize: 30,
              letterSpacing: '-0.03em',
              textTransform: 'none',
              margin: 0,
              lineHeight: 1.05,
              textWrap: 'pretty',
            }}
          >
            {instruction}
          </h1>
          {hint ? (
            <p
              className="mono"
              style={{
                margin: '12px 0 0',
                opacity: 0.6,
                textTransform: 'none',
                letterSpacing: '0.02em',
              }}
            >
              {hint}
            </p>
          ) : null}
        </div>
        {headerExtra}
      </div>

      {children}

      <div
        className="pad mono"
        style={{ padding: '0 24px 28px', textAlign: 'center', minHeight: 20 }}
      >
        {footer ? <span style={{ opacity: 0.55 }}>{footer}</span> : null}
      </div>
    </main>
  );
}

/** Marks the word the instruction turns on, e.g. the target value. */
export function Target({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ background: 'var(--color-chartreuse)', color: 'var(--color-ink)', padding: '0 6px' }}>
      {children}
    </span>
  );
}

export interface ErasedGameProps {
  config: unknown;
  onComplete: (result: unknown) => void;
  reducedMotion: boolean;
}

export type AnyGameComponent = React.ComponentType<ErasedGameProps>;
