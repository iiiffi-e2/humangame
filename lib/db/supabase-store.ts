import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DailyManifest } from '@/features/game-engine/types';
import type {
  ChallengeLink,
  ChallengePlay,
  Crew,
  CrewMember,
  CrowdResponse,
  CrowdTallyRow,
  DataStore,
  ModerationReport,
  Player,
  PlayerStats,
  Rivalry,
  Run,
  RunEventRecord,
} from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function toPlayer(row: Row): Player {
  return {
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name,
    country: row.country ?? null,
    isGuest: row.is_guest,
    authUserId: row.auth_user_id ?? null,
    email: row.email ?? null,
    authProvider: row.auth_provider ?? 'guest',
    isAdmin: row.is_admin ?? false,
    settings: row.settings,
    createdAt: row.created_at,
    firstDayNumber: row.first_day_number ?? 1,
  };
}

function fromPlayer(player: Partial<Player>): Row {
  const row: Row = {};
  if (player.id !== undefined) row.id = player.id;
  if (player.username !== undefined) row.username = player.username;
  if (player.displayName !== undefined) row.display_name = player.displayName;
  if (player.country !== undefined) row.country = player.country;
  if (player.isGuest !== undefined) row.is_guest = player.isGuest;
  if (player.authUserId !== undefined) row.auth_user_id = player.authUserId;
  if (player.email !== undefined) row.email = player.email;
  if (player.authProvider !== undefined) row.auth_provider = player.authProvider;
  if (player.isAdmin !== undefined) row.is_admin = player.isAdmin;
  if (player.settings !== undefined) row.settings = player.settings;
  if (player.createdAt !== undefined) row.created_at = player.createdAt;
  if (player.firstDayNumber !== undefined) row.first_day_number = player.firstDayNumber;
  return row;
}

function toRun(row: Row, events: RunEventRecord[]): Run {
  return {
    id: row.id,
    playerId: row.player_id,
    manifestId: row.manifest_id,
    date: row.date,
    dayNumber: row.day_number,
    mode: row.mode,
    status: row.status,
    totalScore: row.total_score,
    percentile: row.percentile ?? null,
    trust: row.trust,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    tokenJti: row.token_jti,
    shareToken: row.share_token ?? null,
    fromChallengeToken: row.from_challenge_token ?? null,
    events: events.sort((a, b) => a.index - b.index),
  };
}

function fromRun(run: Partial<Run>): Row {
  const row: Row = {};
  if (run.id !== undefined) row.id = run.id;
  if (run.playerId !== undefined) row.player_id = run.playerId;
  if (run.manifestId !== undefined) row.manifest_id = run.manifestId;
  if (run.date !== undefined) row.date = run.date;
  if (run.dayNumber !== undefined) row.day_number = run.dayNumber;
  if (run.mode !== undefined) row.mode = run.mode;
  if (run.status !== undefined) row.status = run.status;
  if (run.totalScore !== undefined) row.total_score = run.totalScore;
  if (run.percentile !== undefined) row.percentile = run.percentile;
  if (run.trust !== undefined) row.trust = run.trust;
  if (run.startedAt !== undefined) row.started_at = run.startedAt;
  if (run.finishedAt !== undefined) row.finished_at = run.finishedAt;
  if (run.tokenJti !== undefined) row.token_jti = run.tokenJti;
  if (run.shareToken !== undefined) row.share_token = run.shareToken;
  if (run.fromChallengeToken !== undefined) row.from_challenge_token = run.fromChallengeToken;
  return row;
}

function toEvent(row: Row): RunEventRecord {
  return {
    index: row.event_index,
    pillar: row.pillar,
    gameId: row.game_id,
    result: row.result,
    rawMetric: Number(row.raw_metric),
    normalized: Number(row.normalized),
    points: row.points,
    label: row.label,
    durationMs: row.duration_ms,
    telemetryHash: row.telemetry_hash,
    voided: row.voided ?? false,
  };
}

function fromEvent(runId: string, event: RunEventRecord): Row {
  return {
    run_id: runId,
    event_index: event.index,
    pillar: event.pillar,
    game_id: event.gameId,
    result: event.result,
    raw_metric: event.rawMetric,
    normalized: event.normalized,
    points: event.points,
    label: event.label,
    duration_ms: event.durationMs,
    telemetry_hash: event.telemetryHash,
    voided: event.voided,
  };
}

/**
 * Production data store, backed by Postgres through Supabase.
 *
 * Uses the service-role key, so it is server-only and bypasses RLS on
 * purpose: every policy in `supabase/migrations` exists to constrain the
 * *browser* client, while scoring and run finalisation must be able to write
 * rows the player themselves may not. Nothing here is ever imported from a
 * client component.
 */
export class SupabaseStore implements DataStore {
  readonly kind = 'supabase' as const;
  private readonly client: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /* players */

  async getPlayer(id: string): Promise<Player | null> {
    const { data, error } = await this.client.from('players').select('*').eq('id', id).maybeSingle();
    fail('getPlayer', error);
    return data ? toPlayer(data) : null;
  }

  async getPlayerByUsername(username: string): Promise<Player | null> {
    const { data, error } = await this.client
      .from('players')
      .select('*')
      .ilike('username', username)
      .maybeSingle();
    fail('getPlayerByUsername', error);
    return data ? toPlayer(data) : null;
  }

  async getPlayerByAuthUser(authUserId: string): Promise<Player | null> {
    const { data, error } = await this.client
      .from('players')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    fail('getPlayerByAuthUser', error);
    return data ? toPlayer(data) : null;
  }

  async createPlayer(input: Omit<Player, 'createdAt'> & { createdAt?: string }): Promise<Player> {
    const { data, error } = await this.client
      .from('players')
      .insert(fromPlayer({ ...input, createdAt: input.createdAt ?? new Date().toISOString() }))
      .select('*')
      .single();
    fail('createPlayer', error);
    return toPlayer(data as Row);
  }

  async updatePlayer(id: string, patch: Partial<Player>): Promise<Player> {
    const { data, error } = await this.client
      .from('players')
      .update(fromPlayer(patch))
      .eq('id', id)
      .select('*')
      .single();
    fail('updatePlayer', error);
    return toPlayer(data as Row);
  }

  async getPlayers(ids: readonly string[]): Promise<Player[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.client.from('players').select('*').in('id', [...ids]);
    fail('getPlayers', error);
    return (data ?? []).map(toPlayer);
  }

  /* manifests */

  private toManifest(row: Row): DailyManifest {
    return {
      id: row.id,
      date: row.date,
      dayNumber: row.day_number,
      seed: row.seed,
      version: row.version,
      status: row.status,
      events: row.events,
    };
  }

  async getManifestByDate(date: string): Promise<DailyManifest | null> {
    const { data, error } = await this.client
      .from('daily_manifests')
      .select('*')
      .eq('date', date)
      .maybeSingle();
    fail('getManifestByDate', error);
    return data ? this.toManifest(data) : null;
  }

  async getManifestById(id: string): Promise<DailyManifest | null> {
    const { data, error } = await this.client
      .from('daily_manifests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    fail('getManifestById', error);
    return data ? this.toManifest(data) : null;
  }

  async saveManifest(manifest: DailyManifest): Promise<DailyManifest> {
    const { data, error } = await this.client
      .from('daily_manifests')
      .upsert(
        {
          id: manifest.id,
          date: manifest.date,
          day_number: manifest.dayNumber,
          seed: manifest.seed,
          version: manifest.version,
          status: manifest.status,
          events: manifest.events,
        },
        { onConflict: 'date' },
      )
      .select('*')
      .single();
    fail('saveManifest', error);
    return this.toManifest(data as Row);
  }

  async listManifests(fromDate: string, days: number): Promise<DailyManifest[]> {
    const { data, error } = await this.client
      .from('daily_manifests')
      .select('*')
      .gte('date', fromDate)
      .order('date', { ascending: true })
      .limit(days);
    fail('listManifests', error);
    return (data ?? []).map((row) => this.toManifest(row));
  }

  /* runs */

  private async attachEvents(rows: Row[]): Promise<Run[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const { data, error } = await this.client.from('run_events').select('*').in('run_id', ids);
    fail('attachEvents', error);
    const byRun = new Map<string, RunEventRecord[]>();
    for (const row of data ?? []) {
      const list = byRun.get(row.run_id) ?? [];
      list.push(toEvent(row));
      byRun.set(row.run_id, list);
    }
    return rows.map((row) => toRun(row, byRun.get(row.id) ?? []));
  }

  async createRun(run: Run): Promise<Run> {
    const { error } = await this.client.from('runs').insert(fromRun(run));
    if (error) {
      // 23505 is the partial unique index on (player_id, manifest_id).
      if (error.code === '23505') throw new Error('ALREADY_PLAYED');
      throw new Error(`createRun: ${error.message}`);
    }
    if (run.events.length > 0) {
      const { error: eventError } = await this.client
        .from('run_events')
        .insert(run.events.map((event) => fromEvent(run.id, event)));
      fail('createRun events', eventError);
    }
    return run;
  }

  async getRun(id: string): Promise<Run | null> {
    const { data, error } = await this.client.from('runs').select('*').eq('id', id).maybeSingle();
    fail('getRun', error);
    if (!data) return null;
    const [run] = await this.attachEvents([data]);
    return run ?? null;
  }

  async updateRun(id: string, patch: Partial<Run>): Promise<Run> {
    const { error } = await this.client.from('runs').update(fromRun(patch)).eq('id', id);
    fail('updateRun', error);
    if (patch.events) {
      await this.client.from('run_events').delete().eq('run_id', id);
      if (patch.events.length > 0) {
        const { error: eventError } = await this.client
          .from('run_events')
          .insert(patch.events.map((event) => fromEvent(id, event)));
        fail('updateRun events', eventError);
      }
    }
    const run = await this.getRun(id);
    if (!run) throw new Error(`Run ${id} not found`);
    return run;
  }

  async getOfficialRun(playerId: string, manifestId: string): Promise<Run | null> {
    const { data, error } = await this.client
      .from('runs')
      .select('*')
      .eq('player_id', playerId)
      .eq('manifest_id', manifestId)
      .eq('mode', 'official')
      .neq('status', 'abandoned')
      .maybeSingle();
    fail('getOfficialRun', error);
    if (!data) return null;
    const [run] = await this.attachEvents([data]);
    return run ?? null;
  }

  async getRunByShareToken(token: string): Promise<Run | null> {
    const { data, error } = await this.client
      .from('runs')
      .select('*')
      .eq('share_token', token)
      .maybeSingle();
    fail('getRunByShareToken', error);
    if (!data) return null;
    const [run] = await this.attachEvents([data]);
    return run ?? null;
  }

  async listFinishedRuns(manifestId: string): Promise<Run[]> {
    const { data, error } = await this.client
      .from('runs')
      .select('*')
      .eq('manifest_id', manifestId)
      .eq('mode', 'official')
      .eq('status', 'finished')
      .order('total_score', { ascending: false })
      .limit(5000);
    fail('listFinishedRuns', error);
    return this.attachEvents(data ?? []);
  }

  async listRunsForPlayer(playerId: string, limit: number): Promise<Run[]> {
    const { data, error } = await this.client
      .from('runs')
      .select('*')
      .eq('player_id', playerId)
      .eq('mode', 'official')
      .order('date', { ascending: false })
      .limit(limit);
    fail('listRunsForPlayer', error);
    return this.attachEvents(data ?? []);
  }

  async listRunsForPlayers(playerIds: readonly string[], manifestId: string): Promise<Run[]> {
    if (playerIds.length === 0) return [];
    const { data, error } = await this.client
      .from('runs')
      .select('*')
      .in('player_id', [...playerIds])
      .eq('manifest_id', manifestId)
      .eq('mode', 'official');
    fail('listRunsForPlayers', error);
    return this.attachEvents(data ?? []);
  }

  async listFinishedRunsInRange(
    playerId: string,
    fromDate: string,
    toDate: string,
  ): Promise<Run[]> {
    const { data, error } = await this.client
      .from('runs')
      .select('*')
      .eq('player_id', playerId)
      .eq('mode', 'official')
      .eq('status', 'finished')
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true });
    fail('listFinishedRunsInRange', error);
    return this.attachEvents(data ?? []);
  }

  /* crowd */

  async addCrowdResponse(response: CrowdResponse): Promise<void> {
    const { error } = await this.client.from('crowd_responses').upsert(
      {
        id: response.id,
        manifest_id: response.manifestId,
        event_index: response.eventIndex,
        player_id: response.playerId,
        option_id: response.optionId,
        value: response.value,
        created_at: response.createdAt,
      },
      { onConflict: 'manifest_id,event_index,player_id', ignoreDuplicates: true },
    );
    fail('addCrowdResponse', error);
  }

  async getCrowdTally(manifestId: string, eventIndex: number): Promise<CrowdTallyRow> {
    const { data, error } = await this.client
      .from('crowd_responses')
      .select('option_id,value')
      .eq('manifest_id', manifestId)
      .eq('event_index', eventIndex)
      .limit(50_000);
    fail('getCrowdTally', error);
    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of data ?? []) {
      total += 1;
      if (row.option_id) counts[row.option_id] = (counts[row.option_id] ?? 0) + 1;
      else if (typeof row.value === 'number') counts.yes = (counts.yes ?? 0) + row.value / 100;
    }
    return { counts, total };
  }

  /* stats */

  async getStats(playerId: string): Promise<PlayerStats | null> {
    const { data, error } = await this.client
      .from('player_stats')
      .select('*')
      .eq('player_id', playerId)
      .maybeSingle();
    fail('getStats', error);
    if (!data) return null;
    return {
      playerId: data.player_id,
      streak: data.streak,
      longestStreak: data.longest_streak,
      lastPlayedDate: data.last_played_date ?? null,
      runsPlayed: data.runs_played,
      bestScore: data.best_score,
      bestDayNumber: data.best_day_number ?? null,
      totalScore: data.total_score,
      pillarTotals: data.pillar_totals,
      top50Streak: data.top50_streak,
      top10Streak: data.top10_streak,
      longestTop10Streak: data.longest_top10_streak,
    };
  }

  async saveStats(stats: PlayerStats): Promise<PlayerStats> {
    const { error } = await this.client.from('player_stats').upsert(
      {
        player_id: stats.playerId,
        streak: stats.streak,
        longest_streak: stats.longestStreak,
        last_played_date: stats.lastPlayedDate,
        runs_played: stats.runsPlayed,
        best_score: stats.bestScore,
        best_day_number: stats.bestDayNumber,
        total_score: stats.totalScore,
        pillar_totals: stats.pillarTotals,
        top50_streak: stats.top50Streak,
        top10_streak: stats.top10Streak,
        longest_top10_streak: stats.longestTop10Streak,
      },
      { onConflict: 'player_id' },
    );
    fail('saveStats', error);
    return stats;
  }

  /* rivalries */

  private toRivalry(row: Row): Rivalry {
    return {
      id: row.id,
      playerAId: row.player_a_id,
      playerBId: row.player_b_id,
      status: row.status,
      requestedBy: row.requested_by,
      nemesisFor: row.nemesis_for ?? [],
      createdAt: row.created_at,
    };
  }

  async listRivalries(playerId: string): Promise<Rivalry[]> {
    const { data, error } = await this.client
      .from('rivalries')
      .select('*')
      .or(`player_a_id.eq.${playerId},player_b_id.eq.${playerId}`);
    fail('listRivalries', error);
    return (data ?? []).map((row) => this.toRivalry(row));
  }

  async getRivalry(playerAId: string, playerBId: string): Promise<Rivalry | null> {
    const [a, b] = [playerAId, playerBId].sort() as [string, string];
    const { data, error } = await this.client
      .from('rivalries')
      .select('*')
      .eq('player_a_id', a)
      .eq('player_b_id', b)
      .maybeSingle();
    fail('getRivalry', error);
    return data ? this.toRivalry(data) : null;
  }

  async saveRivalry(rivalry: Rivalry): Promise<Rivalry> {
    const { error } = await this.client.from('rivalries').upsert(
      {
        id: rivalry.id,
        player_a_id: rivalry.playerAId,
        player_b_id: rivalry.playerBId,
        status: rivalry.status,
        requested_by: rivalry.requestedBy,
        nemesis_for: rivalry.nemesisFor,
        created_at: rivalry.createdAt,
      },
      { onConflict: 'player_a_id,player_b_id' },
    );
    fail('saveRivalry', error);
    return rivalry;
  }

  /* crews */

  private toCrew(row: Row): Crew {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      inviteCode: row.invite_code,
      ownerId: row.owner_id,
      createdAt: row.created_at,
    };
  }

  async createCrew(crew: Crew): Promise<Crew> {
    const { error } = await this.client.from('crews').insert({
      id: crew.id,
      name: crew.name,
      slug: crew.slug,
      invite_code: crew.inviteCode,
      owner_id: crew.ownerId,
      created_at: crew.createdAt,
    });
    if (error?.code === '23505') throw new Error('Crew name already taken');
    fail('createCrew', error);
    return crew;
  }

  async getCrewBySlug(slug: string): Promise<Crew | null> {
    const { data, error } = await this.client.from('crews').select('*').eq('slug', slug).maybeSingle();
    fail('getCrewBySlug', error);
    return data ? this.toCrew(data) : null;
  }

  async getCrewByInviteCode(code: string): Promise<Crew | null> {
    const { data, error } = await this.client
      .from('crews')
      .select('*')
      .ilike('invite_code', code)
      .maybeSingle();
    fail('getCrewByInviteCode', error);
    return data ? this.toCrew(data) : null;
  }

  async getCrew(id: string): Promise<Crew | null> {
    const { data, error } = await this.client.from('crews').select('*').eq('id', id).maybeSingle();
    fail('getCrew', error);
    return data ? this.toCrew(data) : null;
  }

  async listCrewsForPlayer(playerId: string): Promise<Crew[]> {
    const { data, error } = await this.client
      .from('crew_members')
      .select('crew_id')
      .eq('player_id', playerId);
    fail('listCrewsForPlayer', error);
    const ids = (data ?? []).map((row) => row.crew_id);
    if (ids.length === 0) return [];
    const { data: crews, error: crewError } = await this.client
      .from('crews')
      .select('*')
      .in('id', ids);
    fail('listCrewsForPlayer crews', crewError);
    return (crews ?? []).map((row) => this.toCrew(row));
  }

  async addCrewMember(member: CrewMember): Promise<CrewMember> {
    const { error } = await this.client.from('crew_members').upsert(
      {
        crew_id: member.crewId,
        player_id: member.playerId,
        role: member.role,
        joined_at: member.joinedAt,
      },
      { onConflict: 'crew_id,player_id', ignoreDuplicates: true },
    );
    fail('addCrewMember', error);
    return member;
  }

  async listCrewMembers(crewId: string): Promise<CrewMember[]> {
    const { data, error } = await this.client
      .from('crew_members')
      .select('*')
      .eq('crew_id', crewId);
    fail('listCrewMembers', error);
    return (data ?? []).map((row) => ({
      crewId: row.crew_id,
      playerId: row.player_id,
      role: row.role,
      joinedAt: row.joined_at,
    }));
  }

  /* challenges */

  async createChallenge(link: ChallengeLink): Promise<ChallengeLink> {
    const { error } = await this.client.from('challenge_links').upsert(
      {
        token: link.token,
        run_id: link.runId,
        player_id: link.playerId,
        manifest_id: link.manifestId,
        created_at: link.createdAt,
      },
      { onConflict: 'token' },
    );
    fail('createChallenge', error);
    return link;
  }

  async getChallenge(token: string): Promise<ChallengeLink | null> {
    const { data, error } = await this.client
      .from('challenge_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    fail('getChallenge', error);
    if (!data) return null;
    return {
      token: data.token,
      runId: data.run_id,
      playerId: data.player_id,
      manifestId: data.manifest_id,
      createdAt: data.created_at,
    };
  }

  async getChallengeForRun(runId: string): Promise<ChallengeLink | null> {
    const { data, error } = await this.client
      .from('challenge_links')
      .select('*')
      .eq('run_id', runId)
      .maybeSingle();
    fail('getChallengeForRun', error);
    if (!data) return null;
    return {
      token: data.token,
      runId: data.run_id,
      playerId: data.player_id,
      manifestId: data.manifest_id,
      createdAt: data.created_at,
    };
  }

  async recordChallengePlay(play: ChallengePlay): Promise<ChallengePlay> {
    const { error } = await this.client.from('challenge_plays').upsert(
      {
        id: play.id,
        token: play.token,
        player_id: play.playerId,
        run_id: play.runId,
        created_at: play.createdAt,
      },
      { onConflict: 'token,player_id', ignoreDuplicates: true },
    );
    fail('recordChallengePlay', error);
    return play;
  }

  async listChallengePlays(token: string): Promise<ChallengePlay[]> {
    const { data, error } = await this.client
      .from('challenge_plays')
      .select('*')
      .eq('token', token);
    fail('listChallengePlays', error);
    return (data ?? []).map((row) => ({
      id: row.id,
      token: row.token,
      playerId: row.player_id,
      runId: row.run_id,
      createdAt: row.created_at,
    }));
  }

  /* moderation */

  async createReport(report: ModerationReport): Promise<ModerationReport> {
    const { error } = await this.client.from('moderation_reports').insert({
      id: report.id,
      reporter_id: report.reporterId,
      subject_type: report.subjectType,
      subject_id: report.subjectId,
      reason: report.reason,
      status: report.status,
      created_at: report.createdAt,
    });
    fail('createReport', error);
    return report;
  }

  async listReports(status?: ModerationReport['status']): Promise<ModerationReport[]> {
    let query = this.client.from('moderation_reports').select('*');
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    fail('listReports', error);
    return (data ?? []).map((row) => ({
      id: row.id,
      reporterId: row.reporter_id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
    }));
  }
}
