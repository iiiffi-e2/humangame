import 'server-only';
import { formatDistanceToNowStrict } from 'date-fns';
import { buildRivalryRecord, seasonKeyFor, type RivalryRecord } from '@/features/rivalries/record';
import { monthlyStandings, type MonthlyStanding } from '@/features/crews/standings';
import { histogram, isProvisional, median, percentileOf, topPercent } from '@/features/results/percentile';
import { liveStreak, pillarAverages, strongestPillar } from '@/features/results/stats';
import { PILLARS, type Pillar } from '@/features/game-engine/types';
import { addDays, currentDateKey, msUntilReset } from '@/lib/daily/reset';
import { ensureManifest } from '@/lib/daily/service';
import { getStore } from '@/lib/db';
import type { Crew, Player, PlayerStats, Run } from '@/lib/db/types';
import { countsForPublicBoards } from '@/lib/anti-cheat';

/**
 * Read models for the screens.
 *
 * Pages are server components that call one of these and render. Nothing
 * here mutates, and every function returns a plain object so a page can pass
 * it straight into a client component without a serialisation surprise.
 */

export interface DayStats {
  dayNumber: number;
  date: string;
  players: number;
  median: number;
  perfect: number;
  histogram: number[];
}

async function dayStats(dateKey: string): Promise<DayStats | null> {
  const store = getStore();
  const manifest = await store.getManifestByDate(dateKey);
  if (!manifest) return null;
  const runs = (await store.listFinishedRuns(manifest.id)).filter((run) =>
    countsForPublicBoards(run.trust),
  );
  const scores = runs.map((run) => run.totalScore);
  return {
    dayNumber: manifest.dayNumber,
    date: manifest.date,
    players: scores.length,
    median: median(scores),
    perfect: scores.filter((score) => score >= 9_900).length,
    histogram: histogram(scores),
  };
}

export interface FriendStatus {
  playerId: string;
  displayName: string;
  username: string | null;
  played: boolean;
  /** Only ever populated once the viewer has finished their own run. */
  score: number | null;
  isNemesis: boolean;
  seasonRecord: [number, number] | null;
}

/**
 * The social graph: accepted rivals plus crew mates. Exact scores are held
 * back until the viewer has finished, which is the rule the whole product
 * hangs on — nobody gets to scout the day before they play it.
 */
export async function friendStatuses(
  viewer: Player,
  manifestId: string,
  viewerHasPlayed: boolean,
): Promise<FriendStatus[]> {
  const store = getStore();
  const rivalries = (await store.listRivalries(viewer.id)).filter(
    (rivalry) => rivalry.status === 'active',
  );
  const crews = await store.listCrewsForPlayer(viewer.id);
  const crewMemberIds = (
    await Promise.all(crews.map((crew) => store.listCrewMembers(crew.id)))
  ).flatMap((members) => members.map((member) => member.playerId));

  const ids = [
    ...new Set([
      ...rivalries.map((rivalry) =>
        rivalry.playerAId === viewer.id ? rivalry.playerBId : rivalry.playerAId,
      ),
      ...crewMemberIds,
    ]),
  ].filter((id) => id !== viewer.id);

  if (ids.length === 0) return [];

  const [players, runs] = await Promise.all([
    store.getPlayers(ids),
    store.listRunsForPlayers(ids, manifestId),
  ]);
  const byPlayer = new Map(
    runs.filter((run) => run.status === 'finished').map((run) => [run.playerId, run]),
  );

  const statuses = await Promise.all(
    players.map(async (player): Promise<FriendStatus> => {
      const run = byPlayer.get(player.id);
      const rivalry = rivalries.find(
        (entry) => entry.playerAId === player.id || entry.playerBId === player.id,
      );
      let seasonRecord: [number, number] | null = null;
      if (rivalry) {
        const [viewerRuns, otherRuns] = await Promise.all([
          store.listRunsForPlayer(viewer.id, 400),
          store.listRunsForPlayer(player.id, 400),
        ]);
        const record = buildRivalryRecord({
          runsA: viewerRuns,
          runsB: otherRuns,
          seasonKey: seasonKeyFor(currentDateKey()),
        });
        seasonRecord = [record.seasonWinsA, record.seasonWinsB];
      }
      return {
        playerId: player.id,
        displayName: player.displayName,
        username: player.username,
        played: Boolean(run),
        score: viewerHasPlayed ? (run?.totalScore ?? null) : null,
        isNemesis: Boolean(rivalry?.nemesisFor.includes(viewer.id)),
        seasonRecord,
      };
    }),
  );

  return statuses.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

export interface HomeData {
  dayNumber: number;
  date: string;
  resetInMs: number;
  todayPlayers: number;
  yesterday: DayStats | null;
  todayStats: DayStats | null;
  streak: number;
  hasPlayed: boolean;
  todayRunId: string | null;
  nemesis: FriendStatus | null;
  friends: FriendStatus[];
  crew: { crew: Crew; playedToday: number; size: number; monthlyPlace: number | null } | null;
  stats: PlayerStats | null;
}

export async function getHomeData(viewer: Player): Promise<HomeData> {
  const store = getStore();
  const today = currentDateKey();
  const manifest = await ensureManifest(today);
  const officialRun = await store.getOfficialRun(viewer.id, manifest.id);
  const hasPlayed = officialRun?.status === 'finished';

  const [yesterday, todayStats, stats, friends, crews] = await Promise.all([
    dayStats(addDays(today, -1)),
    dayStats(today),
    store.getStats(viewer.id),
    friendStatuses(viewer, manifest.id, hasPlayed),
    store.listCrewsForPlayer(viewer.id),
  ]);

  const crew = crews[0] ?? null;
  let crewSummary: HomeData['crew'] = null;
  if (crew) {
    const members = await store.listCrewMembers(crew.id);
    const memberIds = members.map((member) => member.playerId);
    const [todayRuns, monthRuns] = await Promise.all([
      store.listRunsForPlayers(memberIds, manifest.id),
      Promise.all(
        memberIds.map((id) => store.listRunsForPlayer(id, 60)),
      ).then((lists) => lists.flat()),
    ]);
    const standings = monthlyStandings(memberIds, monthRuns, today.slice(0, 7));
    const place = standings.findIndex((entry) => entry.playerId === viewer.id);
    crewSummary = {
      crew,
      playedToday: todayRuns.filter((run) => run.status === 'finished').length,
      size: members.length,
      monthlyPlace: place >= 0 ? place + 1 : null,
    };
  }

  return {
    dayNumber: manifest.dayNumber,
    date: manifest.date,
    resetInMs: msUntilReset(),
    todayPlayers: todayStats?.players ?? 0,
    yesterday,
    todayStats,
    streak: liveStreak(stats, today),
    hasPlayed,
    todayRunId: officialRun?.status === 'finished' ? officialRun.id : null,
    nemesis: friends.find((friend) => friend.isNemesis) ?? null,
    friends,
    crew: crewSummary,
    stats,
  };
}

/* ------------------------------------------------------------------ */
/* Leaderboards                                                        */
/* ------------------------------------------------------------------ */

export type LeaderboardTab = 'friends' | 'crews' | 'global' | 'country' | 'month';

export interface BoardRow {
  rank: number;
  playerId: string;
  displayName: string;
  username: string | null;
  score: number | null;
  percentile: number | null;
  played: boolean;
  isViewer: boolean;
  isNemesis: boolean;
  /** Rank movement against yesterday: positive is up. */
  movement: number | null;
}

/** A row on the month-consistency board, which ranks showing up. */
export interface MonthRow {
  playerId: string;
  displayName: string;
  isViewer: boolean;
  points: number;
  daysPlayed: number;
  bestScore: number;
  wins: number;
}

export interface LeaderboardData {
  tab: LeaderboardTab;
  dayNumber: number;
  rows: BoardRow[];
  /** Only populated for the month tab. */
  monthRows: MonthRow[];
  viewerHasPlayed: boolean;
  countryAvailable: boolean;
  note: string | null;
}

/** Country boards only appear once there are enough players to be meaningful. */
export const COUNTRY_MINIMUM = 25;

export async function getLeaderboard(
  viewer: Player,
  tab: LeaderboardTab,
): Promise<LeaderboardData> {
  const store = getStore();
  const today = currentDateKey();
  const manifest = await ensureManifest(today);
  const viewerRun = await store.getOfficialRun(viewer.id, manifest.id);
  const viewerHasPlayed = viewerRun?.status === 'finished';

  const yesterdayManifest = await store.getManifestByDate(addDays(today, -1));
  const yesterdayRuns = yesterdayManifest
    ? await store.listFinishedRuns(yesterdayManifest.id)
    : [];
  const yesterdayRank = new Map<string, number>();
  [...yesterdayRuns]
    .sort((a, b) => b.totalScore - a.totalScore)
    .forEach((run, index) => yesterdayRank.set(run.playerId, index + 1));

  const buildRows = async (runs: Run[], extraIds: string[] = []): Promise<BoardRow[]> => {
    const ids = [...new Set([...runs.map((run) => run.playerId), ...extraIds])];
    const players = await store.getPlayers(ids);
    const rivalries = await store.listRivalries(viewer.id);
    const nemesisIds = new Set(
      rivalries
        .filter((rivalry) => rivalry.nemesisFor.includes(viewer.id))
        .map((rivalry) => (rivalry.playerAId === viewer.id ? rivalry.playerBId : rivalry.playerAId)),
    );
    const byPlayer = new Map(runs.map((run) => [run.playerId, run]));

    const sorted = [...players].sort((a, b) => {
      const scoreA = byPlayer.get(a.id)?.totalScore ?? -1;
      const scoreB = byPlayer.get(b.id)?.totalScore ?? -1;
      return scoreB - scoreA || a.displayName.localeCompare(b.displayName);
    });

    let rank = 0;
    return sorted.map((player) => {
      const run = byPlayer.get(player.id);
      const played = Boolean(run);
      if (played) rank += 1;
      const isViewer = player.id === viewer.id;
      const hidden = !viewerHasPlayed && !isViewer;
      const previous = yesterdayRank.get(player.id);
      return {
        rank: played ? rank : 0,
        playerId: player.id,
        displayName: isViewer ? player.displayName : player.displayName,
        username: player.username,
        score: hidden ? null : (run?.totalScore ?? null),
        percentile: hidden ? null : (run?.percentile ?? null),
        played,
        isViewer,
        isNemesis: nemesisIds.has(player.id),
        movement: played && previous ? previous - rank : null,
      };
    });
  };

  if (tab === 'global') {
    const runs = (await store.listFinishedRuns(manifest.id))
      .filter((run) => countsForPublicBoards(run.trust))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 50);
    return {
      tab,
      dayNumber: manifest.dayNumber,
      rows: await buildRows(runs),
      monthRows: [],
      viewerHasPlayed,
      countryAvailable: true,
      note: `Top 50 of ${(await store.listFinishedRuns(manifest.id)).length.toLocaleString()} today`,
    };
  }

  if (tab === 'country') {
    const all = (await store.listFinishedRuns(manifest.id)).filter((run) =>
      countsForPublicBoards(run.trust),
    );
    const players = await store.getPlayers(all.map((run) => run.playerId));
    const country = viewer.country;
    const sameCountry = players.filter((player) => player.country && player.country === country);
    if (!country || sameCountry.length < COUNTRY_MINIMUM) {
      return {
        tab,
        dayNumber: manifest.dayNumber,
        rows: [],
        monthRows: [],
        viewerHasPlayed,
        countryAvailable: false,
        note: country
          ? `Not enough players in ${country} yet. It unlocks at ${COUNTRY_MINIMUM}.`
          : 'Set your country in settings to see this board.',
      };
    }
    const ids = new Set(sameCountry.map((player) => player.id));
    const runs = all.filter((run) => ids.has(run.playerId)).slice(0, 50);
    return {
      tab,
      dayNumber: manifest.dayNumber,
      rows: await buildRows(runs),
      monthRows: [],
      viewerHasPlayed,
      countryAvailable: true,
      note: `${country} &middot; ${sameCountry.length} players`,
    };
  }

  if (tab === 'crews') {
    const crews = await store.listCrewsForPlayer(viewer.id);
    const crew = crews[0];
    if (!crew) {
      return {
        tab,
        dayNumber: manifest.dayNumber,
        rows: [],
        monthRows: [],
        viewerHasPlayed,
        countryAvailable: true,
        note: 'You are not in a crew yet.',
      };
    }
    const members = await store.listCrewMembers(crew.id);
    const ids = members.map((member) => member.playerId);
    const runs = (await store.listRunsForPlayers(ids, manifest.id)).filter(
      (run) => run.status === 'finished',
    );
    return {
      tab,
      dayNumber: manifest.dayNumber,
      rows: await buildRows(runs, ids),
      monthRows: [],
      viewerHasPlayed,
      countryAvailable: true,
      note: crew.name,
    };
  }

  if (tab === 'month') {
    // Consistency, not peaks: the same placement points a crew month uses, so
    // a player who shows up every day out-ranks one big Tuesday.
    const social = await friendStatuses(viewer, manifest.id, viewerHasPlayed);
    const ids = [...social.map((friend) => friend.playerId), viewer.id];
    const players = await store.getPlayers(ids);
    const runs = (await Promise.all(ids.map((id) => store.listRunsForPlayer(id, 60)))).flat();
    const nameOf = new Map(players.map((player) => [player.id, player.displayName]));
    const standings = monthlyStandings(ids, runs, today.slice(0, 7));
    return {
      tab,
      dayNumber: manifest.dayNumber,
      rows: [],
      monthRows: standings.map((standing) => ({
        playerId: standing.playerId,
        displayName: nameOf.get(standing.playerId) ?? 'Player',
        isViewer: standing.playerId === viewer.id,
        points: standing.points,
        daysPlayed: standing.daysPlayed,
        bestScore: standing.bestScore,
        wins: standing.wins,
      })),
      viewerHasPlayed,
      countryAvailable: true,
      note: `${today.slice(0, 7)} · 1st 10 · 2nd 8 · 3rd 6 · 4th 5 · 5th 4 · played 2`,
    };
  }

  const friends = await friendStatuses(viewer, manifest.id, viewerHasPlayed);
  const ids = [...friends.map((friend) => friend.playerId), viewer.id];
  const runs = (await store.listRunsForPlayers(ids, manifest.id)).filter(
    (run) => run.status === 'finished',
  );
  return {
    tab,
    dayNumber: manifest.dayNumber,
    rows: await buildRows(runs, ids),
    monthRows: [],
    viewerHasPlayed,
    countryAvailable: true,
    note: friends.length === 0 ? 'Challenge someone to fill this in.' : null,
  };
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

export interface HistoryDay {
  date: string;
  dayNumber: number;
  score: number | null;
  percentile: number | null;
}

export interface HistoryData {
  days: HistoryDay[];
  averagePercentile: number;
  strongest: Pillar | null;
  weakest: Pillar | null;
  best: { score: number; dayNumber: number; percentile: number | null } | null;
  longestStreak: number;
  currentStreak: number;
  pillars: Record<Pillar, number>;
  medianToday: number;
  hasHistory: boolean;
}

export async function getHistory(viewer: Player, days = 30): Promise<HistoryData> {
  const store = getStore();
  const today = currentDateKey();
  const from = addDays(today, -(days - 1));
  const runs = await store.listFinishedRunsInRange(viewer.id, from, today);
  const stats = await store.getStats(viewer.id);
  const byDate = new Map(runs.map((run) => [run.date, run]));

  const timeline: HistoryDay[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const run = byDate.get(date);
    timeline.push({
      date,
      dayNumber: run?.dayNumber ?? 0,
      score: run?.totalScore ?? null,
      percentile: run?.percentile ?? null,
    });
  }

  const percentiles = runs.map((run) => run.percentile).filter((value): value is number => value !== null);
  const pillars = pillarAverages(runs);
  const ordered = PILLARS.map((pillar) => ({ pillar, value: pillars[pillar] })).sort(
    (a, b) => b.value - a.value,
  );
  const todayStats = await dayStats(today);

  return {
    days: timeline,
    averagePercentile:
      percentiles.length === 0
        ? 0
        : Math.round(percentiles.reduce((sum, value) => sum + value, 0) / percentiles.length),
    strongest: runs.length > 0 ? (ordered[0]?.pillar ?? null) : strongestPillar(stats),
    weakest: runs.length > 0 ? (ordered[ordered.length - 1]?.pillar ?? null) : null,
    best:
      stats && stats.bestScore > 0
        ? {
            score: stats.bestScore,
            dayNumber: stats.bestDayNumber ?? 0,
            percentile:
              runs.find((run) => run.totalScore === stats.bestScore)?.percentile ?? null,
          }
        : null,
    longestStreak: stats?.longestStreak ?? 0,
    currentStreak: liveStreak(stats, today),
    pillars,
    medianToday: todayStats?.median ?? 0,
    hasHistory: runs.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* Crews and rivalries                                                 */
/* ------------------------------------------------------------------ */

export interface CrewView {
  crew: Crew;
  members: Array<{
    playerId: string;
    displayName: string;
    username: string | null;
    isViewer: boolean;
    score: number | null;
    played: boolean;
  }>;
  monthly: Array<MonthlyStanding & { displayName: string }>;
  playedToday: number;
  viewerHasPlayed: boolean;
  isMember: boolean;
}

export async function getCrewView(viewer: Player, slug: string): Promise<CrewView | null> {
  const store = getStore();
  const crew = await store.getCrewBySlug(slug);
  if (!crew) return null;

  const today = currentDateKey();
  const manifest = await ensureManifest(today);
  const members = await store.listCrewMembers(crew.id);
  const ids = members.map((member) => member.playerId);
  const [players, todayRuns, viewerRun] = await Promise.all([
    store.getPlayers(ids),
    store.listRunsForPlayers(ids, manifest.id),
    store.getOfficialRun(viewer.id, manifest.id),
  ]);
  const viewerHasPlayed = viewerRun?.status === 'finished';
  const finished = todayRuns.filter((run) => run.status === 'finished');
  const byPlayer = new Map(finished.map((run) => [run.playerId, run]));

  const monthRuns = (
    await Promise.all(ids.map((id) => store.listRunsForPlayer(id, 60)))
  ).flat();
  const nameOf = new Map(players.map((player) => [player.id, player.displayName]));

  const rows = players
    .map((player) => {
      const run = byPlayer.get(player.id);
      const isViewer = player.id === viewer.id;
      return {
        playerId: player.id,
        displayName: player.displayName,
        username: player.username,
        isViewer,
        played: Boolean(run),
        score: viewerHasPlayed || isViewer ? (run?.totalScore ?? null) : null,
      };
    })
    .sort((a, b) => Number(b.played) - Number(a.played) || (b.score ?? 0) - (a.score ?? 0));

  return {
    crew,
    members: rows,
    monthly: monthlyStandings(ids, monthRuns, today.slice(0, 7)).map((standing) => ({
      ...standing,
      displayName: nameOf.get(standing.playerId) ?? 'Player',
    })),
    playedToday: finished.length,
    viewerHasPlayed,
    isMember: ids.includes(viewer.id),
  };
}

export interface RivalryView {
  viewer: Player;
  rival: Player;
  record: RivalryRecord;
  todayViewer: number | null;
  todayRival: number | null;
  isNemesis: boolean;
  isActive: boolean;
  resetInMs: number;
}

export async function getRivalryView(viewer: Player, rivalId: string): Promise<RivalryView | null> {
  const store = getStore();
  const rival =
    (await store.getPlayer(rivalId)) ?? (await store.getPlayerByUsername(rivalId));
  if (!rival || rival.id === viewer.id) return null;

  const today = currentDateKey();
  const manifest = await ensureManifest(today);
  const [viewerRuns, rivalRuns, rivalry, viewerToday, rivalToday] = await Promise.all([
    store.listRunsForPlayer(viewer.id, 400),
    store.listRunsForPlayer(rival.id, 400),
    store.getRivalry(viewer.id, rival.id),
    store.getOfficialRun(viewer.id, manifest.id),
    store.getOfficialRun(rival.id, manifest.id),
  ]);

  const viewerHasPlayed = viewerToday?.status === 'finished';
  return {
    viewer,
    rival,
    record: buildRivalryRecord({
      runsA: viewerRuns,
      runsB: rivalRuns,
      seasonKey: seasonKeyFor(today),
    }),
    todayViewer: viewerHasPlayed ? (viewerToday?.totalScore ?? null) : null,
    todayRival:
      viewerHasPlayed && rivalToday?.status === 'finished' ? rivalToday.totalScore : null,
    isNemesis: Boolean(rivalry?.nemesisFor.includes(viewer.id)),
    isActive: rivalry?.status === 'active',
    resetInMs: msUntilReset(),
  };
}

/* ------------------------------------------------------------------ */
/* Challenge landing                                                   */
/* ------------------------------------------------------------------ */

export interface ChallengeView {
  token: string;
  challengerName: string;
  challengerId: string;
  score: number;
  topPercent: number;
  dayNumber: number;
  date: string;
  playedAgo: string;
  isToday: boolean;
  viewerHasPlayed: boolean;
  viewerScore: number | null;
  viewerRunId: string | null;
  provisional: boolean;
}

export async function getChallengeView(
  viewer: Player,
  token: string,
): Promise<ChallengeView | null> {
  const store = getStore();
  const link = await store.getChallenge(token);
  if (!link) return null;
  const run = await store.getRun(link.runId);
  if (!run || run.status !== 'finished') return null;
  const challenger = await store.getPlayer(link.playerId);
  if (!challenger) return null;

  const today = currentDateKey();
  const manifest = await ensureManifest(today);
  const viewerRun = await store.getOfficialRun(viewer.id, manifest.id);
  const population = (await store.listFinishedRuns(run.manifestId))
    .filter((entry) => countsForPublicBoards(entry.trust))
    .map((entry) => entry.totalScore);
  const percentile = run.percentile ?? percentileOf({ score: run.totalScore, population });

  // Relative time is the one place a local timezone is the right answer: the
  // recipient wants to know how fresh this score is, in their own day.
  const finishedAt = run.finishedAt ? new Date(run.finishedAt) : new Date();
  const sinceMs = Date.now() - finishedAt.getTime();

  return {
    token,
    challengerName: challenger.displayName,
    challengerId: challenger.id,
    score: run.totalScore,
    topPercent: topPercent(percentile),
    dayNumber: run.dayNumber,
    date: run.date,
    playedAgo:
      sinceMs < 60_000
        ? 'Played just now'
        : `Played ${formatDistanceToNowStrict(finishedAt)} ago`,
    isToday: run.date === today,
    viewerHasPlayed: viewerRun?.status === 'finished',
    viewerScore: viewerRun?.status === 'finished' ? viewerRun.totalScore : null,
    viewerRunId: viewerRun?.status === 'finished' ? viewerRun.id : null,
    provisional: isProvisional(population.length),
  };
}
