import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AngleField, HalfField, PercentField } from '@/features/games/eye/fields';

const noop = () => undefined;

describe('Eye lock bars', () => {
  it('keeps nudges on Half, where there is no number to count to', () => {
    const html = renderToString(
      <HalfField
        config={{ angleDeg: 0, length: 0.8, target: 0.5, perfect: 0.004, zero: 0.16 }}
        onComplete={noop}
        reducedMotion
      />,
    );
    expect(html).toContain('Nudge up');
    expect(html).toContain('Nudge down');
  });

  it('removes +/− from Percent so the fill cannot be counted to', () => {
    const html = renderToString(
      <PercentField
        config={{ targetPercent: 37, startPercent: 40, perfect: 1, zero: 34 }}
        onComplete={noop}
        reducedMotion
      />,
    );
    expect(html).not.toContain('Nudge up');
    expect(html).not.toContain('Nudge down');
    expect(html).toContain('Lock it in');
  });

  it('hides Angle’s live degree number and +/−', () => {
    const html = renderToString(
      <AngleField
        config={{ targetDeg: 142, startDeg: 20, perfect: 1.5, zero: 58 }}
        onComplete={noop}
        reducedMotion
      />,
    );
    expect(html).not.toContain('Nudge up');
    expect(html).not.toContain('°');
  });
});
