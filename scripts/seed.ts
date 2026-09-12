/**
 * Development seed.
 *
 * Builds a world that makes every screen worth looking at: a hundred players,
 * thirty days of history with a believable score distribution, a live rivalry
 * between Eric and Tara, and the IIIFFI crew. Run it against the local
 * file-backed store (the default) or a real Supabase project.
 *
 *   npm run seed
 */
import { randomUUID } from 'node:crypto';
import { getGame } from '@/features/game-engine/registry';
import { applyRun, emptyStats } from '@/features/results/stats';
import { percentileOf } from '@/features/results/percentile';
import { generateInviteCode, crewSlug } from '@/lib/auth/username';
import { addDays, currentDateKey } from '@/lib/daily/reset';
import { generateManifest, validateManifest } from '@/lib/daily/manifest';
import { createStore as getStore } from '@/lib/db/factory';
import { MemoryStore } from '@/lib/db/memory-store';
import { DEFAULT_SETTINGS, type Player, type Run, type RunEventRecord } from '@/lib/db/types';
import { serverEnv } from '@/lib/env';
import { createRng } from '@/lib/rng';
import { MAX_EVENT_POINTS } from '@/lib/scoring';

const DAYS = 30;
const CROWD_SIZE = 100;

const FIRST_NAMES = [
  'Eric', 'Tara', 'Josh', 'Mina', 'Dev', 'Sam', 'Kai', 'Noor', 'Bea', 'Ivo',
  'Rey', 'Lena', 'Otto', 'Pia', 'Quinn', 'Rafa', 'Suki', 'Theo', 'Uma', 'Vik',
  'Wren', 'Xan', 'Yara', 'Zed', 'Ada', 'Bo', 'Cleo', 'Dax', 'Elle', 'Finn',
];

const COUNTRIES = ['GB', 'US', 'DE', 'FR', 'JP', 'BR', 'NG', 'IN', 'AU', 'CA'];

/** Box-Muller, so the daily field looks like a real population. */
function normal(rng: () => number, mean: number, deviation: number): number {
  const u = Math.max(1e-9, rng());
  const v = Math.max(1e-9, rng());
  return mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function splitIntoEvents(
  total: number,
  rng: () => number,
  manifestEvents: ReadonlyArray<{ index: number; pillar: Run['events'][number]['pillar']; gameId: string }>,
): RunEventRecord[] {
  // Spread the run total across five events with some per-pillar noise, then
  // correct the rounding drift onto the last event so the parts always sum.
  const weights = manifestEvents.map(() => 0.6 + rng() * 0.8);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  let assigned = 0;

  return manifestEvents.map((event, index) => {
    const isLast = index === manifestEvents.length - 1;
    const share = isLast
      ? total - assigned
      : Math.round((total * (weights[index] as number)) / weightSum);
    const points = Math.max(0, Math.min(MAX_EVENT_POINTS, share));
    assigned += points;
    const definition = getGame(event.gameId);
    return {
      index: event.index,
      pillar: event.pillar,
      gameId: event.gameId,
      result: null,
      rawMetric: Math.round(rng() * 100) / 10,
      normalized: points / MAX_EVENT_POINTS,
      points,
      label: definition.name,
      durationMs: 2_000 + Math.round(rng() * 9_000),
      telemetryHash: 'seed',
      voided: false,
    };
  });
}

async function main(): Promise<void> {
  const store = getStore();
  if (store instanceof MemoryStore) {
    // One file write at the end instead of one per row.
    await store.bulk(() => seed());
    return;
  }
  await seed();
}

async function seed(): Promise<void> {
  const store = getStore();
  const env = serverEnv();
  const today = currentDateKey();
  const rng = createRng('human-seed-v1');

  console.log(`Seeding ${store.kind} store · ${DAYS} days up to ${today}`);

  // --- manifests ----------------------------------------------------------
  const manifests = [];
  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const existing = await store.getManifestByDate(date);
    if (existing) {
      manifests.push(existing);
      continue;
    }
    const manifest = generateManifest(date, { secret: env.manifestSecret });
    validateManifest(manifest);
    manifests.push(await store.saveManifest({ ...manifest, status: 'frozen' }));
  }

  // --- players ------------------------------------------------------------
  const players: Player[] = [];
  const usedNames = new Set<string>();
  for (let index = 0; index < CROWD_SIZE; index += 1) {
    const base = FIRST_NAMES[index % FIRST_NAMES.length] as string;
    let displayName = base;
    let suffix = 2;
    while (usedNames.has(displayName)) {
      displayName = `${base}${suffix}`;
      suffix += 1;
    }
    usedNames.add(displayName);

    const username = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const existing = await store.getPlayerByUsername(username);
    if (existing) {
      players.push(existing);
      continue;
    }
    players.push(
      await store.createPlayer({
        id: randomUUID(),
        username,
        displayName,
        country: COUNTRIES[index % COUNTRIES.length] ?? 'GB',
        isGuest: false,
        authUserId: null,
        email: null,
        authProvider: 'email',
        isAdmin: index === 0,
        settings: { ...DEFAULT_SETTINGS },
        firstDayNumber: Math.max(1, (manifests[0]?.dayNumber ?? 1) - Math.floor(rng.next() * 40)),
      }),
    );
  }

  const eric = players[0] as Player;
  const tara = players[1] as Player;

  // Each player gets a latent skill, so the same names stay good across days.
  const skill = new Map(players.map((player) => [player.id, normal(() => rng.next(), 6400, 1300)]));
  // How reliably they show up, so the history grid has real gaps.
  const attendance = new Map(players.map((player) => [player.id, 0.55 + rng.next() * 0.45]));
  attendance.set(eric.id, 0.97);
  attendance.set(tara.id, 0.97);

  // --- runs ---------------------------------------------------------------
  let created = 0;
  for (const manifest of manifests) {
    const dayScores: Array<{ playerId: string; run: Run }> = [];

    for (const player of players) {
      if (rng.next() > (attendance.get(player.id) ?? 0.8)) continue;
      const existing = await store.getOfficialRun(player.id, manifest.id);
      if (existing) continue;

      const target = Math.max(
        800,
        Math.min(9_950, Math.round(normal(() => rng.next(), skill.get(player.id) ?? 6_000, 700))),
      );
      const events = splitIntoEvents(target, () => rng.next(), manifest.events);
      const total = events.reduce((sum, event) => sum + event.points, 0);

      const run: Run = {
        id: randomUUID(),
        playerId: player.id,
        manifestId: manifest.id,
        date: manifest.date,
        dayNumber: manifest.dayNumber,
        mode: 'official',
        status: 'finished',
        totalScore: total,
        percentile: null,
        trust: 'ok',
        startedAt: new Date(`${manifest.date}T09:00:00.000Z`).toISOString(),
        finishedAt: new Date(`${manifest.date}T09:01:15.000Z`).toISOString(),
        tokenJti: randomUUID(),
        shareToken: randomUUID().slice(0, 10),
        fromChallengeToken: null,
        events,
      };
      await store.createRun(run);
      dayScores.push({ playerId: player.id, run });
      created += 1;
    }

    // Percentiles need the whole day, so they are filled in afterwards.
    const population = dayScores.map((entry) => entry.run.totalScore);
    for (const entry of dayScores) {
      const percentile = percentileOf({ score: entry.run.totalScore, population });
      await store.updateRun(entry.run.id, { percentile });
      entry.run.percentile = percentile;
    }
  }

  // --- stats --------------------------------------------------------------
  for (const player of players) {
    const runs = await store.listRunsForPlayer(player.id, 400);
    let stats = emptyStats(player.id);
    for (const run of [...runs].sort((a, b) => a.date.localeCompare(b.date))) {
      stats = applyRun({
        stats,
        run: {
          date: run.date,
          dayNumber: run.dayNumber,
          totalScore: run.totalScore,
          percentile: run.percentile,
          events: run.events,
        },
      });
    }
    await store.saveStats(stats);
  }

  // --- rivalry ------------------------------------------------------------
  const [a, b] = [eric.id, tara.id].sort() as [string, string];
  await store.saveRivalry({
    id: randomUUID(),
    playerAId: a,
    playerBId: b,
    status: 'active',
    requestedBy: eric.id,
    nemesisFor: [eric.id, tara.id],
    createdAt: new Date().toISOString(),
  });

  // --- crew ---------------------------------------------------------------
  const crewName = 'IIIFFI';
  let crew = await store.getCrewBySlug(crewSlug(crewName));
  if (!crew) {
    crew = await store.createCrew({
      id: randomUUID(),
      name: crewName,
      slug: crewSlug(crewName),
      inviteCode: generateInviteCode(() => rng.next()),
      ownerId: eric.id,
      createdAt: new Date().toISOString(),
    });
  }
  for (const member of players.slice(0, 7)) {
    await store.addCrewMember({
      crewId: crew.id,
      playerId: member.id,
      role: member.id === eric.id ? 'owner' : 'member',
      joinedAt: new Date().toISOString(),
    });
  }

  // --- a challenge link to open ------------------------------------------
  const ericToday = await store.getOfficialRun(eric.id, (manifests.at(-1) as { id: string }).id);
  if (ericToday) {
    await store.createChallenge({
      token: 'demo01',
      runId: ericToday.id,
      playerId: eric.id,
      manifestId: ericToday.manifestId,
      createdAt: new Date().toISOString(),
    });
  }

  console.log(`Done. ${players.length} players, ${created} runs, crew ${crew.inviteCode}.`);
  console.log('Challenge link: /c/demo01');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
