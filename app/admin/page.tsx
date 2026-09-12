import { notFound } from 'next/navigation';
import { AdminBoard } from '@/features/admin/AdminBoard';
import { histogram } from '@/features/results/percentile';
import { isAdmin, requirePlayer } from '@/lib/auth/session';
import { addDays, currentDateKey } from '@/lib/daily/reset';
import { ensureManifest } from '@/lib/daily/service';
import { generateManifest } from '@/lib/daily/manifest';
import { getStore } from '@/lib/db';
import { serverEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Admin', robots: { index: false } };

/**
 * The daily manifest console.
 *
 * Shows the next thirty days, lets a family be swapped before a day is
 * frozen, and — the part that has to work under pressure — lets a defective
 * event be voided after a day has gone live.
 */
export default async function AdminPage() {
  const player = await requirePlayer();
  if (!isAdmin(player)) notFound();

  const store = getStore();
  const today = currentDateKey();
  await ensureManifest(today);

  // Fill in any days that have not been generated yet so the console always
  // shows a full month ahead.
  const stored = await store.listManifests(today, 30);
  const known = new Set(stored.map((manifest) => manifest.date));
  const preview = [];
  for (let offset = 0; offset < 30; offset += 1) {
    const date = addDays(today, offset);
    const existing = stored.find((manifest) => manifest.date === date);
    preview.push(
      existing ??
        generateManifest(date, { secret: serverEnv().manifestSecret }),
    );
    known.add(date);
  }

  const todayManifest = preview[0];
  const runs = todayManifest ? await store.listFinishedRuns(todayManifest.id) : [];
  const scores = runs.map((run) => run.totalScore);

  const errorByEvent = (todayManifest?.events ?? []).map((event) => {
    const points = runs
      .map((run) => run.events.find((entry) => entry.index === event.index)?.points ?? null)
      .filter((value): value is number => value !== null);
    return {
      index: event.index,
      pillar: event.pillar,
      gameId: event.gameId,
      plays: points.length,
      averagePoints:
        points.length === 0
          ? 0
          : Math.round(points.reduce((sum, value) => sum + value, 0) / points.length),
      distribution: histogram(
        points.map((value) => value * 5),
        10,
      ),
    };
  });

  return (
    <AdminBoard
      manifests={preview.map((manifest) => ({
        id: manifest.id,
        date: manifest.date,
        dayNumber: manifest.dayNumber,
        status: manifest.status,
        version: manifest.version,
        stored: stored.some((entry) => entry.date === manifest.date),
        events: manifest.events.map((event) => ({
          index: event.index,
          pillar: event.pillar,
          gameId: event.gameId,
          difficulty: event.difficulty,
          voided: Boolean(event.voided),
          summary: summarise(event.config),
        })),
      }))}
      today={{
        players: scores.length,
        histogram: histogram(scores),
        events: errorByEvent,
      }}
    />
  );
}

/** A short, human-readable digest of a config for the preview list. */
function summarise(config: unknown): string {
  if (!config || typeof config !== 'object') return '';
  const record = config as Record<string, unknown>;
  const interesting = [
    'targetMs',
    'targetPercent',
    'targetDeg',
    'targetSize',
    'question',
    'prompt',
    'setId',
    'questionId',
  ];
  for (const key of interesting) {
    const value = record[key];
    if (value !== undefined) return `${key}: ${String(value).slice(0, 60)}`;
  }
  return Object.keys(record).slice(0, 3).join(', ');
}
