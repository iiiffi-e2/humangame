import 'server-only';
import { createHash } from 'node:crypto';
import { getGame } from '@/features/game-engine/registry';
import type { DailyEvent } from '@/features/game-engine/types';
import type { TrustFlag } from '@/lib/db/types';

/**
 * Pragmatic MVP anti-cheat.
 *
 * The load-bearing protection is that the server re-scores every event from
 * the stored manifest config — the client's claimed points are never read.
 * Everything here is the second line: rejecting payloads that could not have
 * come from real play, and flagging runs that are individually possible but
 * collectively implausible.
 *
 * Deliberately absent: browser fingerprinting, canvas probes, and anything
 * else that identifies a device rather than a behaviour.
 */

export interface EventSubmission {
  index: number;
  result: unknown;
  /** Monotonic milliseconds the player spent on the play field. */
  durationMs: number;
}

export interface PlausibilityIssue {
  index: number;
  reason: string;
}

/** Nobody reads an instruction, plays, and submits in under this. */
export const MIN_EVENT_MS = 150;
/** A whole run that claims to be shorter than this is not a run. */
export const MIN_RUN_MS = 6_000;
/** Leaving the tab for an hour is not a run either. */
export const MAX_RUN_MS = 60 * 60 * 1000;

export function telemetryHash(runId: string, index: number, result: unknown): string {
  return createHash('sha256')
    .update(`${runId}:${index}:${JSON.stringify(result ?? null)}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Check one submitted event against the family's declared timing window.
 * Returns a reason string when the submission is impossible.
 */
export function checkTiming(event: DailyEvent, submission: EventSubmission): string | null {
  const definition = getGame(event.gameId);
  const [minMs, maxMs] = definition.timingWindow(event.config);
  const duration = submission.durationMs;
  if (!Number.isFinite(duration) || duration < 0) return 'duration missing';
  if (duration < Math.max(MIN_EVENT_MS, minMs * 0.8)) return 'too fast to be real';
  if (duration > maxMs * 3) return 'field was open too long';
  return null;
}

export interface TrustInput {
  issues: PlausibilityIssue[];
  totalScore: number;
  runDurationMs: number;
  /** Points per event, in order. */
  eventPoints: readonly number[];
}

/**
 * Decide how much to trust a finished run.
 *
 * `suspect` runs still count for the player — they see their score and their
 * streak — but are shadow-excluded from public boards and from the percentile
 * denominator, so one scripted account cannot move everyone else's ranking.
 */
export function assessTrust(input: TrustInput): { trust: TrustFlag; reasons: string[] } {
  const reasons: string[] = [];

  for (const issue of input.issues) reasons.push(`event ${issue.index}: ${issue.reason}`);
  if (input.runDurationMs < MIN_RUN_MS) reasons.push('run finished implausibly fast');
  if (input.runDurationMs > MAX_RUN_MS) reasons.push('run spanned more than an hour');

  // Near-perfection is worth recording but is not, on its own, evidence of
  // anything: elite players exist, and punishing the best runs would make the
  // leaderboard actively wrong. It only counts against a run that already has
  // an impossible event in it.
  const perfectEvents = input.eventPoints.filter((points) => points >= 1990).length;
  const suspiciouslyClean = perfectEvents >= 4;
  if (suspiciouslyClean) reasons.push('near-perfect on four or more events');

  const impossible = input.issues.length >= 2 || input.runDurationMs < MIN_RUN_MS;
  if (impossible) return { trust: 'excluded', reasons };

  const doubtful =
    input.issues.length === 1 || input.runDurationMs > MAX_RUN_MS || (suspiciouslyClean && input.issues.length > 0);
  if (doubtful) return { trust: 'suspect', reasons };

  return { trust: 'ok', reasons };
}

/** Runs that are allowed to appear on public boards and set percentiles. */
export function countsForPublicBoards(trust: TrustFlag): boolean {
  return trust === 'ok';
}
