import { finishRun, startOfficialRun, submitEvent } from '@/features/game-engine/run-service';
import type { DailyEvent } from '@/features/game-engine/types';
import { createStore } from '@/lib/db/factory';
import { DEFAULT_SETTINGS } from '@/lib/db/types';
import { currentDateKey } from '@/lib/daily/reset';

/** A result that should score well for whichever family the day picked. */
export function goodAnswer(event: DailyEvent): unknown {
  const config = event.config as Record<string, unknown>;
  switch (event.gameId) {
    case 'nerve.dead-stop':
      return { heldMs: config.targetMs as number };
    case 'nerve.crosshair':
      return { tapMs: 500 };
    case 'nerve.grow': {
      const target = config.targetSize as number;
      const start = config.startSize as number;
      const rate = config.growthPerSecond as number;
      return { releaseMs: ((target - start) / rate) * 1000 };
    }
    case 'eye.half':
      return { fraction: config.target as number };
    case 'eye.percent':
      return { valuePercent: config.targetPercent as number };
    case 'eye.angle':
      return { deg: config.targetDeg as number };
    case 'memory.flash-grid':
      return { picked: config.cells as number[] };
    case 'memory.what-moved':
      return { pickedId: config.movedId as string, elapsedMs: 2000 };
    case 'memory.sequence':
      return { entered: config.sequence as string[] };
    case 'brain.order':
      return { order: config.solution as string[] };
    case 'brain.next':
      return { pickedId: config.answerId as string, elapsedMs: 3000 };
    case 'brain.rotate':
      return { pickedId: config.answerId as string, elapsedMs: 3000 };
    case 'crowd.majority':
    case 'crowd.avoid':
      return { pickedId: (config.options as Array<{ id: string }>)[0]?.id };
    case 'crowd.split':
      return { predicted: config.priorPercent as number };
    default:
      throw new Error(`No answer for ${event.gameId}`);
  }
}

export async function seedPlayer(id: string): Promise<void> {
  await createStore().createPlayer({
    id,
    username: null,
    displayName: 'Tester',
    country: null,
    isGuest: true,
    authUserId: null,
    email: null,
    authProvider: 'guest',
    isAdmin: false,
    settings: { ...DEFAULT_SETTINGS },
    firstDayNumber: 1,
  });
}

/**
 * Play a whole run and return the finish payload.
 *
 * The run is backdated by 90 seconds before finishing: a real run takes about
 * that long, and the anti-cheat check on total run duration would otherwise
 * (correctly) flag a run that started and finished in the same millisecond.
 */
export async function playFullRun(playerId: string) {
  const { token, manifest, run } = await startOfficialRun(playerId, currentDateKey());
  for (const event of manifest.events) {
    await submitEvent({
      token,
      index: event.index,
      result: goodAnswer(event),
      durationMs: 8_000,
    });
  }
  await createStore().updateRun(run.id, {
    startedAt: new Date(Date.now() - 90_000).toISOString(),
  });
  return { finished: await finishRun(token), token, manifest };
}
