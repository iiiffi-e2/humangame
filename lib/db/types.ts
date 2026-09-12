import type { DailyManifest, Pillar } from '@/features/game-engine/types';

export type TrustFlag = 'ok' | 'suspect' | 'excluded';
export type RunMode = 'official' | 'practice';
export type RunStatus = 'active' | 'finished' | 'abandoned';

export interface PlayerSettings {
  sound: boolean;
  haptics: boolean;
  reduceMotion: boolean;
  notifications: 'off' | 'rivals' | 'all';
  /** Who may see this player's exact daily scores. */
  privacy: 'private' | 'friends' | 'public';
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  sound: true,
  haptics: true,
  reduceMotion: false,
  notifications: 'rivals',
  privacy: 'friends',
};

export interface Player {
  id: string;
  /** Claimed handle, lowercase, unique. Null until the player claims one. */
  username: string | null;
  displayName: string;
  country: string | null;
  isGuest: boolean;
  authUserId: string | null;
  /** Only set once an account is linked. Never shown to other players. */
  email: string | null;
  authProvider: 'guest' | 'email' | 'google' | 'apple' | 'passkey';
  isAdmin: boolean;
  settings: PlayerSettings;
  createdAt: string;
  firstDayNumber: number;
}

export interface RunEventRecord {
  index: number;
  pillar: Pillar;
  gameId: string;
  /** The player's submitted result, kept for re-scoring and audit. */
  result: unknown;
  rawMetric: number;
  normalized: number;
  points: number;
  label: string;
  durationMs: number;
  /** sha256 of the submitted payload — see lib/anti-cheat. */
  telemetryHash: string;
  voided: boolean;
}

export interface Run {
  id: string;
  playerId: string;
  manifestId: string;
  date: string;
  dayNumber: number;
  mode: RunMode;
  status: RunStatus;
  totalScore: number;
  /** Frozen at finish; `null` while the run is active. */
  percentile: number | null;
  trust: TrustFlag;
  startedAt: string;
  finishedAt: string | null;
  /** Single-use id baked into the run token. */
  tokenJti: string;
  shareToken: string | null;
  /** Challenge the run was started from, if any. */
  fromChallengeToken: string | null;
  events: RunEventRecord[];
}

export interface PlayerStats {
  playerId: string;
  streak: number;
  longestStreak: number;
  lastPlayedDate: string | null;
  runsPlayed: number;
  bestScore: number;
  bestDayNumber: number | null;
  totalScore: number;
  pillarTotals: Record<Pillar, number>;
  top50Streak: number;
  top10Streak: number;
  longestTop10Streak: number;
}

export interface Rivalry {
  id: string;
  /** Always stored with `playerAId < playerBId` so a pair has one row. */
  playerAId: string;
  playerBId: string;
  status: 'pending' | 'active' | 'declined';
  requestedBy: string;
  /** Player ids that have pinned the other as their Nemesis. */
  nemesisFor: string[];
  createdAt: string;
}

export interface Crew {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
}

export interface CrewMember {
  crewId: string;
  playerId: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface CrowdResponse {
  id: string;
  manifestId: string;
  eventIndex: number;
  playerId: string;
  /** For MAJORITY / AVOID. */
  optionId: string | null;
  /** For SPLIT — the 0..100 call. */
  value: number | null;
  createdAt: string;
}

export interface ChallengeLink {
  token: string;
  runId: string;
  playerId: string;
  manifestId: string;
  createdAt: string;
}

export interface ChallengePlay {
  id: string;
  token: string;
  playerId: string;
  runId: string;
  createdAt: string;
}

export interface ModerationReport {
  id: string;
  reporterId: string;
  subjectType: 'player' | 'crew';
  subjectId: string;
  reason: string;
  status: 'open' | 'reviewed' | 'actioned';
  createdAt: string;
}

export interface CrowdTallyRow {
  counts: Record<string, number>;
  total: number;
}

export interface LeaderboardRow {
  playerId: string;
  username: string | null;
  displayName: string;
  country: string | null;
  score: number;
  percentile: number | null;
  rank: number;
}

/**
 * Everything HUMAN persists. Two implementations ship: Supabase/Postgres for
 * real deployments, and a file-backed store used when Supabase is not
 * configured so the app runs and the tests pass on a clean checkout.
 */
export interface DataStore {
  readonly kind: 'supabase' | 'memory';

  /* players */
  getPlayer(id: string): Promise<Player | null>;
  getPlayerByUsername(username: string): Promise<Player | null>;
  getPlayerByAuthUser(authUserId: string): Promise<Player | null>;
  createPlayer(input: Omit<Player, 'createdAt'> & { createdAt?: string }): Promise<Player>;
  updatePlayer(id: string, patch: Partial<Player>): Promise<Player>;
  getPlayers(ids: readonly string[]): Promise<Player[]>;

  /* manifests */
  getManifestByDate(date: string): Promise<DailyManifest | null>;
  getManifestById(id: string): Promise<DailyManifest | null>;
  saveManifest(manifest: DailyManifest): Promise<DailyManifest>;
  listManifests(fromDate: string, days: number): Promise<DailyManifest[]>;

  /* runs */
  createRun(run: Run): Promise<Run>;
  getRun(id: string): Promise<Run | null>;
  updateRun(id: string, patch: Partial<Run>): Promise<Run>;
  getOfficialRun(playerId: string, manifestId: string): Promise<Run | null>;
  getRunByShareToken(token: string): Promise<Run | null>;
  listFinishedRuns(manifestId: string): Promise<Run[]>;
  listRunsForPlayer(playerId: string, limit: number): Promise<Run[]>;
  listRunsForPlayers(playerIds: readonly string[], manifestId: string): Promise<Run[]>;
  listFinishedRunsInRange(playerId: string, fromDate: string, toDate: string): Promise<Run[]>;

  /* crowd */
  addCrowdResponse(response: CrowdResponse): Promise<void>;
  getCrowdTally(manifestId: string, eventIndex: number): Promise<CrowdTallyRow>;

  /* stats */
  getStats(playerId: string): Promise<PlayerStats | null>;
  saveStats(stats: PlayerStats): Promise<PlayerStats>;

  /* rivalries */
  listRivalries(playerId: string): Promise<Rivalry[]>;
  getRivalry(playerAId: string, playerBId: string): Promise<Rivalry | null>;
  saveRivalry(rivalry: Rivalry): Promise<Rivalry>;

  /* crews */
  createCrew(crew: Crew): Promise<Crew>;
  getCrewBySlug(slug: string): Promise<Crew | null>;
  getCrewByInviteCode(code: string): Promise<Crew | null>;
  getCrew(id: string): Promise<Crew | null>;
  listCrewsForPlayer(playerId: string): Promise<Crew[]>;
  addCrewMember(member: CrewMember): Promise<CrewMember>;
  listCrewMembers(crewId: string): Promise<CrewMember[]>;

  /* challenges */
  createChallenge(link: ChallengeLink): Promise<ChallengeLink>;
  getChallenge(token: string): Promise<ChallengeLink | null>;
  getChallengeForRun(runId: string): Promise<ChallengeLink | null>;
  recordChallengePlay(play: ChallengePlay): Promise<ChallengePlay>;
  listChallengePlays(token: string): Promise<ChallengePlay[]>;

  /* moderation */
  createReport(report: ModerationReport): Promise<ModerationReport>;
  listReports(status?: ModerationReport['status']): Promise<ModerationReport[]>;
}
