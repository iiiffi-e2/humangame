import { createHash, createHmac } from 'node:crypto';
import { createRng } from '@/lib/rng';
import { GAMES_BY_PILLAR, getGame } from '@/features/game-engine/registry';
import { PILLARS, type DailyEvent, type DailyManifest, type Pillar } from '@/features/game-engine/types';
import { dayNumberFor } from './reset';

/**
 * The daily seed is HMAC(secret, date). Knowing yesterday's seed tells you
 * nothing about tomorrow's, and the same secret always reproduces the same
 * day, so manifests can be regenerated from scratch if a database is lost.
 */
export function deriveSeed(dateKey: string, secret: string): string {
  return createHmac('sha256', secret).update(`human:v1:${dateKey}`).digest('hex').slice(0, 40);
}

export interface GenerateManifestOptions {
  secret: string;
  version?: number;
  /** Admin override: force a specific game family for a pillar. */
  familyOverrides?: Partial<Record<Pillar, string>>;
  /** Admin override: use an explicit seed rather than deriving one. */
  seed?: string;
}

/**
 * Build a full day. Pillars always run in the same order — NERVE, EYE,
 * MEMORY, BRAIN, CROWD — because the run is a 75-second arc and CROWD is the
 * one event that reads as a payoff rather than a test.
 */
export function generateManifest(
  dateKey: string,
  options: GenerateManifestOptions,
): DailyManifest {
  const version = options.version ?? 1;
  const seed = options.seed ?? deriveSeed(dateKey, options.secret);
  const picker = createRng(`${seed}:families:v${version}`);

  const events: DailyEvent[] = PILLARS.map((pillar, index) => {
    const pool = GAMES_BY_PILLAR[pillar];
    if (pool.length === 0) throw new Error(`No games registered for pillar ${pillar}`);
    const overrideId = options.familyOverrides?.[pillar];
    const definition = overrideId ? getGame(overrideId) : picker.pick(pool);
    if (definition.pillar !== pillar) {
      throw new Error(`Family ${definition.id} is not a ${pillar} game`);
    }
    // Difficulty drifts across the week so days feel different without any
    // single day being unplayable.
    const difficulty = Math.round(picker.float(0.25, 0.85) * 100) / 100;
    const eventSeed = `${seed}:${index}:${definition.id}:v${version}`;
    const config = definition.createConfig(eventSeed, difficulty);
    definition.validateConfig(config);
    return { index, pillar, gameId: definition.id, difficulty, seed: eventSeed, config };
  });

  return {
    id: `manifest-${dateKey}-v${version}`,
    date: dateKey,
    dayNumber: dayNumberFor(dateKey),
    seed,
    version,
    status: 'draft',
    events,
  };
}

/**
 * Stable hash of a manifest's playable content. Used to detect that a frozen
 * manifest was edited after going live.
 */
export function manifestFingerprint(manifest: DailyManifest): string {
  const payload = JSON.stringify(
    manifest.events.map((event) => [event.index, event.gameId, event.difficulty, event.config]),
  );
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/** Re-validate every event's config. Run before freezing a manifest. */
export function validateManifest(manifest: DailyManifest): void {
  if (manifest.events.length !== PILLARS.length) {
    throw new Error(`Manifest ${manifest.date} has ${manifest.events.length} events`);
  }
  manifest.events.forEach((event, index) => {
    if (event.index !== index) throw new Error(`Manifest ${manifest.date}: event index mismatch`);
    if (event.pillar !== PILLARS[index]) {
      throw new Error(`Manifest ${manifest.date}: pillar order changed at ${index}`);
    }
    getGame(event.gameId).validateConfig(event.config);
  });
}

/**
 * What the client is allowed to see. Identical to the stored event today,
 * but routed through one function so a future family with a hidden answer
 * key has an obvious place to strip it.
 */
export function publicEvent(event: DailyEvent): DailyEvent {
  const definition = getGame(event.gameId);
  const config = definition.redactConfig ? definition.redactConfig(event.config) : event.config;
  return { ...event, config };
}
