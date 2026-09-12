import { describe, expect, it } from 'vitest';
import { buildRivalryRecord, seasonKeyFor } from '@/features/rivalries/record';
import { monthlyStandings, pointsForPlacement, rankDay } from '@/features/crews/standings';
import type { Run } from '@/lib/db/types';

function run(playerId: string, date: string, total: number): Run {
  return {
    id: `${playerId}-${date}`,
    playerId,
    manifestId: `manifest-${date}-v1`,
    date,
    dayNumber: 1,
    mode: 'official',
    status: 'finished',
    totalScore: total,
    percentile: 50,
    trust: 'ok',
    startedAt: `${date}T09:00:00.000Z`,
    finishedAt: `${date}T09:01:00.000Z`,
    tokenJti: 'jti',
    shareToken: null,
    fromChallengeToken: null,
    events: [],
  };
}

describe('rivalry records', () => {
  const season = seasonKeyFor('2026-09-12');

  it('counts only the days both players finished', () => {
    const record = buildRivalryRecord({
      runsA: [run('a', '2026-09-10', 8000), run('a', '2026-09-11', 7000)],
      runsB: [run('b', '2026-09-10', 7500)],
      seasonKey: season,
    });
    expect(record.seasonWinsA).toBe(1);
    expect(record.seasonWinsB).toBe(0);
    expect(record.outcomes.find((entry) => entry.date === '2026-09-11')?.winner).toBe('none');
  });

  it('tracks the current streak and who holds it', () => {
    const record = buildRivalryRecord({
      runsA: [run('a', '2026-09-10', 8000), run('a', '2026-09-11', 8000), run('a', '2026-09-12', 100)],
      runsB: [run('b', '2026-09-10', 100), run('b', '2026-09-11', 100), run('b', '2026-09-12', 9000)],
      seasonKey: season,
    });
    expect(record.streakHolder).toBe('b');
    expect(record.currentStreak).toBe(1);
    expect(record.longestStreakA).toBe(2);
  });

  it('averages the margin only over contested days', () => {
    const record = buildRivalryRecord({
      runsA: [run('a', '2026-09-10', 8000), run('a', '2026-09-11', 6000)],
      runsB: [run('b', '2026-09-10', 7000), run('b', '2026-09-11', 6200)],
      seasonKey: season,
    });
    expect(record.averageMargin).toBe(600);
  });

  it('separates the season from the all-time record', () => {
    const record = buildRivalryRecord({
      runsA: [run('a', '2026-08-30', 9000), run('a', '2026-09-01', 9000)],
      runsB: [run('b', '2026-08-30', 100), run('b', '2026-09-01', 100)],
      seasonKey: '2026-09',
    });
    expect(record.allTimeWinsA).toBe(2);
    expect(record.seasonWinsA).toBe(1);
  });

  it('counts a dead-level day as a tie that breaks nobody', () => {
    const record = buildRivalryRecord({
      runsA: [run('a', '2026-09-10', 5000)],
      runsB: [run('b', '2026-09-10', 5000)],
      seasonKey: season,
    });
    expect(record.ties).toBe(1);
    expect(record.seasonWinsA).toBe(0);
    expect(record.seasonWinsB).toBe(0);
  });
});

describe('crew standings', () => {
  it('awards placement points down the table', () => {
    expect(pointsForPlacement(1)).toBe(10);
    expect(pointsForPlacement(2)).toBe(8);
    expect(pointsForPlacement(3)).toBe(6);
    expect(pointsForPlacement(4)).toBe(5);
    expect(pointsForPlacement(5)).toBe(4);
    expect(pointsForPlacement(6)).toBe(2);
    expect(pointsForPlacement(40)).toBe(2);
  });

  it('gives tied scores the same placement', () => {
    const day = rankDay([
      { playerId: 'a', score: 8000 },
      { playerId: 'b', score: 8000 },
      { playerId: 'c', score: 1000 },
    ]);
    expect(day[0]?.placement).toBe(1);
    expect(day[1]?.placement).toBe(1);
    expect(day[2]?.placement).toBe(3);
  });

  it('rewards turning up over one big day', () => {
    const steady = Array.from({ length: 10 }, (_, index) =>
      run('steady', `2026-09-${String(index + 1).padStart(2, '0')}`, 5000),
    );
    const spike = [run('spike', '2026-09-01', 9900)];
    const table = monthlyStandings(['steady', 'spike'], [...steady, ...spike], '2026-09');
    expect(table[0]?.playerId).toBe('steady');
    expect(table[0]?.daysPlayed).toBe(10);
    expect(table[1]?.points).toBeLessThan(table[0]?.points ?? 0);
  });

  it('ignores runs from another month', () => {
    const table = monthlyStandings(['a'], [run('a', '2026-08-31', 9000)], '2026-09');
    expect(table[0]?.points).toBe(0);
    expect(table[0]?.daysPlayed).toBe(0);
  });
});
