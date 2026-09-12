'use client';

import { GAME_FIELDS } from './fields';

/**
 * Renders the play field for a family.
 *
 * The lookup lives in its own component so the field is selected from a
 * static registry rather than produced inside another component's render —
 * the component identity for a given `gameId` never changes, which is what
 * keeps the field's state alive across the parent's re-renders.
 */
export function GameField({
  gameId,
  config,
  onComplete,
  reducedMotion,
}: {
  gameId: string;
  config: unknown;
  onComplete: (result: unknown) => void;
  reducedMotion: boolean;
}) {
  const Field = GAME_FIELDS[gameId];

  if (!Field) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <span className="mono">This event is not available.</span>
      </div>
    );
  }

  return <Field config={config} onComplete={onComplete} reducedMotion={reducedMotion} />;
}
