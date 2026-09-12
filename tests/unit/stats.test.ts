import { describe, expect, it } from 'vitest';
import { PILLARS } from '@/features/game-engine/types';
import { applyRun, emptyStats, liveStreak, pillarAverages, strongestPillar } from '@/features/results/stats';
import type { PlayerStats, Run, RunEventRecord } from '@/lib/db/types';

function events(points: number[]): RunEventRecord[] {
  return PILLARS.map((pillar, index) => ({
    index,
    pillar,
    gameId: `${pillar}.test`,
    result: null,
    rawMetric: 0,
    normalized: (points[index] ?? 0) / 2000,
    points: points[index] ?? 0,
    label: 'Test',
    durationMs: 4000,
    telemetryHash: 'x',
    voided: false,
  }));
}

function run(date: string, dayNumber: number, total: number, percentile = 50): Parameters<typeof applyRun>[0]['run'] {
  return { date, dayNumber, totalScore: total, percentile, events: events([total / 5, total / 5, total / 5, total / 5, total / 5]) };
}

describe('streaks', () => {
  it('starts at one on the first run', () => {
    const stats = applyRun({ stats: emptyStats('p1'), run: run('2026-09-10', 182, 5000) });
    expect(stats.streak).toBe(1);
    expect(stats.longestStreak).toBe(1);
    expect(stats.runsPlayed).toBe(1);
  });

  it('extends across consecutive days', () => {
    let stats = emptyStats('p1');
    stats = applyRun({ stats, run: run('2026-09-10', 182, 5000) });
    stats = applyRun({ stats, run: run('2026-09-11', 183, 6000) });
    stats = applyRun({ stats, run: run('2026-09-12', 184, 7000) });
    expect(stats.streak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it('resets after a missed day but keeps the record', () => {
    let stats = emptyStats('p1');
    stats = applyRun({ stats, run: run('2026-09-09', 181, 5000) });
    stats = applyRun({ stats, run: run('2026-09-10', 182, 5000) });
    stats = applyRun({ stats, run: run('2026-09-12', 184, 5000) });
    expect(stats.streak).toBe(1);
    expect(stats.longestStreak).toBe(2);
  });

  it('is idempotent for the same day, so a retried finish cannot inflate it', () => {
    let stats = applyRun({ stats: emptyStats('p1'), run: run('2026-09-12', 184, 5000) });
    stats = applyRun({ stats, run: run('2026-09-12', 184, 5000) });
    expect(stats.streak).toBe(1);
    expect(stats.runsPlayed).toBe(1);
    expect(stats.totalScore).toBe(5000);
  });

  it('tracks top-50 and top-10 streaks separately', () => {
    let stats = emptyStats('p1');
    stats = applyRun({ stats, run: run('2026-09-10', 182, 9000, 95) });
    stats = applyRun({ stats, run: run('2026-09-11', 183, 9000, 92) });
    expect(stats.top10Streak).toBe(2);
    expect(stats.top50Streak).toBe(2);
    stats = applyRun({ stats, run: run('2026-09-12', 184, 5000, 60) });
    expect(stats.top10Streak).toBe(0);
    expect(stats.top50Streak).toBe(3);
    expect(stats.longestTop10Streak).toBe(2);
  });

  it('records the best score and the day it happened', () => {
    let stats = emptyStats('p1');
    stats = applyRun({ stats, run: run('2026-09-10', 182, 5000) });
    stats = applyRun({ stats, run: run('2026-09-11', 183, 8000) });
    stats = applyRun({ stats, run: run('2026-09-12', 184, 6000) });
    expect(stats.bestScore).toBe(8000);
    expect(stats.bestDayNumber).toBe(183);
  });
});

describe('liveStreak', () => {
  const base: PlayerStats = { ...emptyStats('p1'), streak: 7, lastPlayedDate: '2026-09-11' };

  it('counts a streak that is still alive yesterday or today', () => {
    expect(liveStreak(base, '2026-09-12')).toBe(7);
    expect(liveStreak({ ...base, lastPlayedDate: '2026-09-12' }, '2026-09-12')).toBe(7);
  });

  it('shows zero once the streak is actually broken', () => {
    expect(liveStreak(base, '2026-09-14')).toBe(0);
    expect(liveStreak(null, '2026-09-12')).toBe(0);
  });
});

describe('pillar summaries', () => {
  it('finds the strongest pillar from lifetime totals', () => {
    const stats = applyRun({
      stats: emptyStats('p1'),
      run: {
        date: '2026-09-12',
        dayNumber: 184,
        totalScore: 7000,
        percentile: 80,
        events: events([1000, 1200, 1900, 900, 1000]),
      },
    });
    expect(strongestPillar(stats)).toBe('memory');
  });

  it('averages pillars across runs as a 0..100 figure', () => {
    const runs = [
      { events: events([2000, 1000, 1000, 1000, 1000]) },
      { events: events([1000, 1000, 1000, 1000, 1000]) },
    ] as unknown as Run[];
    const averages = pillarAverages(runs);
    expect(averages.nerve).toBe(75);
    expect(averages.eye).toBe(50);
  });
});
