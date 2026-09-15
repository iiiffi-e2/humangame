import type { ScoreResult } from '@/lib/scoring';

/**
 * Copy on the mid-run card and the exact line that waits until the reveal.
 *
 * Nerve keeps the physical miss mid-run: the clock is the puzzle, and
 * "40 ms late" does not hand a spectator tomorrow's answer. Everything
 * else shows closeness + pace so a shoulder-surfer cannot read `2.0% off`
 * off the interstitial.
 */

export function exactMetric(gameId: string, rawMetric: number): string {
  const value = rawMetric;
  switch (gameId) {
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

export function eventChips(
  gameId: string,
  score: ScoreResult,
): { primary: string; secondary: string } {
  if (gameId.startsWith('nerve.')) {
    return { primary: exactMetric(gameId, score.rawMetric), secondary: score.label };
  }
  return {
    primary: score.closeness ?? 'Locked in',
    secondary: score.pace ?? score.label,
  };
}
