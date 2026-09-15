import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
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
  Notification,
  Player,
  PlayerBlock,
  PlayerStats,
  Rivalry,
  Run,
} from './types';

interface Snapshot {
  players: Player[];
  manifests: DailyManifest[];
  runs: Run[];
  crowdResponses: CrowdResponse[];
  stats: PlayerStats[];
  rivalries: Rivalry[];
  crews: Crew[];
  crewMembers: CrewMember[];
  challenges: ChallengeLink[];
  challengePlays: ChallengePlay[];
  reports: ModerationReport[];
  blocks: PlayerBlock[];
  notifications: Notification[];
}

const EMPTY: Snapshot = {
  players: [],
  manifests: [],
  runs: [],
  crowdResponses: [],
  stats: [],
  rivalries: [],
  crews: [],
  crewMembers: [],
  challenges: [],
  challengePlays: [],
  reports: [],
  blocks: [],
  notifications: [],
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * A JSON-file-backed implementation of `DataStore`.
 *
 * This is the local-development and test backend: it keeps the whole dataset
 * in memory and writes it back to one file, so a clean checkout can run the
 * full product — official runs, leaderboards, crews, seeded history — with no
 * external services. It is not a production store; `SupabaseStore` is.
 *
 * Writes are serialised through a single promise chain, which is enough for
 * one Node process and keeps the one-official-run-per-day invariant honest
 * without a transaction manager.
 */
export class MemoryStore implements DataStore {
  readonly kind = 'memory' as const;

  private data: Snapshot = clone(EMPTY);
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();
  private bulkDepth = 0;

  constructor(private readonly filePath: string) {}

  /* ---------------------------------------------------------------- */
  /* persistence                                                       */
  /* ---------------------------------------------------------------- */

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<Snapshot>;
      this.data = {
        ...clone(EMPTY),
        ...parsed,
        blocks: parsed.blocks ?? [],
        notifications: parsed.notifications ?? [],
        reports: parsed.reports ?? [],
      };
    } catch {
      this.data = clone(EMPTY);
    }
    this.loaded = true;
  }

  private async flush(): Promise<void> {
    const absolute = path.resolve(this.filePath);
    await mkdir(path.dirname(absolute), { recursive: true });
    const temporary = `${absolute}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(this.data), 'utf8');
    await rename(temporary, absolute);
  }

  /** Serialise every operation so concurrent requests cannot interleave. */
  private run<T>(operation: (data: Snapshot) => T | Promise<T>, mutates: boolean): Promise<T> {
    const next = this.queue.then(async () => {
      await this.load();
      const result = await operation(this.data);
      if (mutates && this.bulkDepth === 0) await this.flush();
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  private read<T>(operation: (data: Snapshot) => T | Promise<T>): Promise<T> {
    return this.run(operation, false);
  }

  private write<T>(operation: (data: Snapshot) => T | Promise<T>): Promise<T> {
    return this.run(operation, true);
  }

  /**
   * Run many writes with a single flush at the end.
   *
   * The seed script writes thousands of rows; rewriting the whole file after
   * each one turns a five-second job into a minute. Correctness is unchanged
   * because every operation still goes through the same serialised queue.
   */
  async bulk<T>(operation: () => Promise<T>): Promise<T> {
    this.bulkDepth += 1;
    try {
      return await operation();
    } finally {
      this.bulkDepth -= 1;
      if (this.bulkDepth === 0) await this.run(() => undefined, true);
    }
  }

  /** Replace the whole dataset. Used by the seed and reset scripts. */
  async replaceAll(snapshot: Partial<Snapshot>): Promise<void> {
    await this.write((data) => {
      Object.assign(data, clone(EMPTY), snapshot);
    });
  }

  /* ---------------------------------------------------------------- */
  /* players                                                           */
  /* ---------------------------------------------------------------- */

  getPlayer(id: string): Promise<Player | null> {
    return this.read((data) => clone(data.players.find((player) => player.id === id) ?? null));
  }

  getPlayerByUsername(username: string): Promise<Player | null> {
    const needle = username.toLowerCase();
    return this.read((data) =>
      clone(data.players.find((player) => player.username?.toLowerCase() === needle) ?? null),
    );
  }

  getPlayerByAuthUser(authUserId: string): Promise<Player | null> {
    return this.read((data) =>
      clone(data.players.find((player) => player.authUserId === authUserId) ?? null),
    );
  }

  createPlayer(input: Omit<Player, 'createdAt'> & { createdAt?: string }): Promise<Player> {
    return this.write((data) => {
      if (data.players.some((player) => player.id === input.id)) {
        throw new Error(`Player ${input.id} already exists`);
      }
      if (input.username) {
        const taken = data.players.some(
          (player) => player.username?.toLowerCase() === input.username?.toLowerCase(),
        );
        if (taken) throw new Error('Username already taken');
      }
      const player: Player = { ...input, createdAt: input.createdAt ?? new Date().toISOString() };
      data.players.push(player);
      return clone(player);
    });
  }

  updatePlayer(id: string, patch: Partial<Player>): Promise<Player> {
    return this.write((data) => {
      const index = data.players.findIndex((player) => player.id === id);
      if (index < 0) throw new Error(`Player ${id} not found`);
      if (patch.username) {
        const taken = data.players.some(
          (player) =>
            player.id !== id && player.username?.toLowerCase() === patch.username?.toLowerCase(),
        );
        if (taken) throw new Error('Username already taken');
      }
      const updated = { ...(data.players[index] as Player), ...patch };
      data.players[index] = updated;
      return clone(updated);
    });
  }

  getPlayers(ids: readonly string[]): Promise<Player[]> {
    const set = new Set(ids);
    return this.read((data) => clone(data.players.filter((player) => set.has(player.id))));
  }

  /* ---------------------------------------------------------------- */
  /* manifests                                                         */
  /* ---------------------------------------------------------------- */

  getManifestByDate(date: string): Promise<DailyManifest | null> {
    return this.read((data) =>
      clone(data.manifests.find((manifest) => manifest.date === date) ?? null),
    );
  }

  getManifestById(id: string): Promise<DailyManifest | null> {
    return this.read((data) => clone(data.manifests.find((manifest) => manifest.id === id) ?? null));
  }

  saveManifest(manifest: DailyManifest): Promise<DailyManifest> {
    return this.write((data) => {
      const index = data.manifests.findIndex((entry) => entry.date === manifest.date);
      if (index >= 0) data.manifests[index] = clone(manifest);
      else data.manifests.push(clone(manifest));
      return clone(manifest);
    });
  }

  listManifests(fromDate: string, days: number): Promise<DailyManifest[]> {
    return this.read((data) =>
      clone(
        data.manifests
          .filter((manifest) => manifest.date >= fromDate)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, days),
      ),
    );
  }

  /* ---------------------------------------------------------------- */
  /* runs                                                              */
  /* ---------------------------------------------------------------- */

  createRun(run: Run): Promise<Run> {
    return this.write((data) => {
      if (run.mode === 'official') {
        // The database enforces this with a partial unique index; here it is
        // enforced inside the serialised write queue.
        const existing = data.runs.find(
          (entry) =>
            entry.playerId === run.playerId &&
            entry.manifestId === run.manifestId &&
            entry.mode === 'official' &&
            entry.status !== 'abandoned',
        );
        if (existing) throw new Error('ALREADY_PLAYED');
      }
      data.runs.push(clone(run));
      return clone(run);
    });
  }

  getRun(id: string): Promise<Run | null> {
    return this.read((data) => clone(data.runs.find((run) => run.id === id) ?? null));
  }

  updateRun(id: string, patch: Partial<Run>): Promise<Run> {
    return this.write((data) => {
      const index = data.runs.findIndex((run) => run.id === id);
      if (index < 0) throw new Error(`Run ${id} not found`);
      const updated = { ...(data.runs[index] as Run), ...clone(patch) };
      data.runs[index] = updated;
      return clone(updated);
    });
  }

  getOfficialRun(playerId: string, manifestId: string): Promise<Run | null> {
    return this.read((data) =>
      clone(
        data.runs.find(
          (run) =>
            run.playerId === playerId &&
            run.manifestId === manifestId &&
            run.mode === 'official' &&
            run.status !== 'abandoned',
        ) ?? null,
      ),
    );
  }

  getRunByShareToken(token: string): Promise<Run | null> {
    return this.read((data) => clone(data.runs.find((run) => run.shareToken === token) ?? null));
  }

  listFinishedRuns(manifestId: string): Promise<Run[]> {
    return this.read((data) =>
      clone(
        data.runs.filter(
          (run) =>
            run.manifestId === manifestId && run.mode === 'official' && run.status === 'finished',
        ),
      ),
    );
  }

  listRunsForPlayer(playerId: string, limit: number): Promise<Run[]> {
    return this.read((data) =>
      clone(
        data.runs
          .filter((run) => run.playerId === playerId && run.mode === 'official')
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, limit),
      ),
    );
  }

  listRunsForPlayers(playerIds: readonly string[], manifestId: string): Promise<Run[]> {
    const set = new Set(playerIds);
    return this.read((data) =>
      clone(
        data.runs.filter(
          (run) => set.has(run.playerId) && run.manifestId === manifestId && run.mode === 'official',
        ),
      ),
    );
  }

  listFinishedRunsInRange(playerId: string, fromDate: string, toDate: string): Promise<Run[]> {
    return this.read((data) =>
      clone(
        data.runs
          .filter(
            (run) =>
              run.playerId === playerId &&
              run.mode === 'official' &&
              run.status === 'finished' &&
              run.date >= fromDate &&
              run.date <= toDate,
          )
          .sort((a, b) => a.date.localeCompare(b.date)),
      ),
    );
  }

  /* ---------------------------------------------------------------- */
  /* crowd                                                             */
  /* ---------------------------------------------------------------- */

  addCrowdResponse(response: CrowdResponse): Promise<void> {
    return this.write((data) => {
      const duplicate = data.crowdResponses.some(
        (entry) =>
          entry.manifestId === response.manifestId &&
          entry.eventIndex === response.eventIndex &&
          entry.playerId === response.playerId,
      );
      if (duplicate) return;
      data.crowdResponses.push(clone(response));
    });
  }

  getCrowdTally(manifestId: string, eventIndex: number): Promise<CrowdTallyRow> {
    return this.read((data) => {
      const counts: Record<string, number> = {};
      let total = 0;
      for (const response of data.crowdResponses) {
        if (response.manifestId !== manifestId || response.eventIndex !== eventIndex) continue;
        total += 1;
        if (response.optionId) {
          counts[response.optionId] = (counts[response.optionId] ?? 0) + 1;
        } else if (typeof response.value === 'number') {
          // SPLIT stores a 0..100 call; `yes` accumulates the mean numerator.
          counts.yes = (counts.yes ?? 0) + response.value / 100;
        }
      }
      return { counts, total };
    });
  }

  /* ---------------------------------------------------------------- */
  /* stats                                                             */
  /* ---------------------------------------------------------------- */

  getStats(playerId: string): Promise<PlayerStats | null> {
    return this.read((data) =>
      clone(data.stats.find((entry) => entry.playerId === playerId) ?? null),
    );
  }

  saveStats(stats: PlayerStats): Promise<PlayerStats> {
    return this.write((data) => {
      const index = data.stats.findIndex((entry) => entry.playerId === stats.playerId);
      if (index >= 0) data.stats[index] = clone(stats);
      else data.stats.push(clone(stats));
      return clone(stats);
    });
  }

  /* ---------------------------------------------------------------- */
  /* rivalries                                                         */
  /* ---------------------------------------------------------------- */

  listRivalries(playerId: string): Promise<Rivalry[]> {
    return this.read((data) =>
      clone(
        data.rivalries.filter(
          (entry) => entry.playerAId === playerId || entry.playerBId === playerId,
        ),
      ),
    );
  }

  getRivalry(playerAId: string, playerBId: string): Promise<Rivalry | null> {
    const [a, b] = [playerAId, playerBId].sort() as [string, string];
    return this.read((data) =>
      clone(
        data.rivalries.find((entry) => entry.playerAId === a && entry.playerBId === b) ?? null,
      ),
    );
  }

  saveRivalry(rivalry: Rivalry): Promise<Rivalry> {
    return this.write((data) => {
      const index = data.rivalries.findIndex(
        (entry) => entry.playerAId === rivalry.playerAId && entry.playerBId === rivalry.playerBId,
      );
      if (index >= 0) data.rivalries[index] = clone(rivalry);
      else data.rivalries.push(clone(rivalry));
      return clone(rivalry);
    });
  }

  /* ---------------------------------------------------------------- */
  /* crews                                                             */
  /* ---------------------------------------------------------------- */

  createCrew(crew: Crew): Promise<Crew> {
    return this.write((data) => {
      if (data.crews.some((entry) => entry.slug === crew.slug)) {
        throw new Error('Crew name already taken');
      }
      data.crews.push(clone(crew));
      return clone(crew);
    });
  }

  updateCrew(id: string, patch: Partial<Crew>): Promise<Crew> {
    return this.write((data) => {
      const index = data.crews.findIndex((crew) => crew.id === id);
      if (index < 0) throw new Error(`Crew ${id} not found`);
      const updated = { ...(data.crews[index] as Crew), ...patch };
      data.crews[index] = updated;
      return clone(updated);
    });
  }

  getCrewBySlug(slug: string): Promise<Crew | null> {
    return this.read((data) => clone(data.crews.find((crew) => crew.slug === slug) ?? null));
  }

  getCrewByInviteCode(code: string): Promise<Crew | null> {
    const needle = code.toUpperCase();
    return this.read((data) =>
      clone(data.crews.find((crew) => crew.inviteCode.toUpperCase() === needle) ?? null),
    );
  }

  getCrew(id: string): Promise<Crew | null> {
    return this.read((data) => clone(data.crews.find((crew) => crew.id === id) ?? null));
  }

  listCrewsForPlayer(playerId: string): Promise<Crew[]> {
    return this.read((data) => {
      const ids = new Set(
        data.crewMembers.filter((member) => member.playerId === playerId).map((m) => m.crewId),
      );
      return clone(data.crews.filter((crew) => ids.has(crew.id)));
    });
  }

  addCrewMember(member: CrewMember): Promise<CrewMember> {
    return this.write((data) => {
      const exists = data.crewMembers.some(
        (entry) => entry.crewId === member.crewId && entry.playerId === member.playerId,
      );
      if (!exists) data.crewMembers.push(clone(member));
      return clone(member);
    });
  }

  listCrewMembers(crewId: string): Promise<CrewMember[]> {
    return this.read((data) =>
      clone(data.crewMembers.filter((member) => member.crewId === crewId)),
    );
  }

  /* ---------------------------------------------------------------- */
  /* challenges                                                        */
  /* ---------------------------------------------------------------- */

  createChallenge(link: ChallengeLink): Promise<ChallengeLink> {
    return this.write((data) => {
      const index = data.challenges.findIndex((entry) => entry.token === link.token);
      if (index >= 0) data.challenges[index] = clone(link);
      else data.challenges.push(clone(link));
      return clone(link);
    });
  }

  getChallenge(token: string): Promise<ChallengeLink | null> {
    return this.read((data) =>
      clone(data.challenges.find((entry) => entry.token === token) ?? null),
    );
  }

  getChallengeForRun(runId: string): Promise<ChallengeLink | null> {
    return this.read((data) =>
      clone(data.challenges.find((entry) => entry.runId === runId) ?? null),
    );
  }

  recordChallengePlay(play: ChallengePlay): Promise<ChallengePlay> {
    return this.write((data) => {
      const exists = data.challengePlays.some(
        (entry) => entry.token === play.token && entry.playerId === play.playerId,
      );
      if (!exists) data.challengePlays.push(clone(play));
      return clone(play);
    });
  }

  listChallengePlays(token: string): Promise<ChallengePlay[]> {
    return this.read((data) =>
      clone(data.challengePlays.filter((entry) => entry.token === token)),
    );
  }

  /* ---------------------------------------------------------------- */
  /* moderation                                                        */
  /* ---------------------------------------------------------------- */

  createReport(report: ModerationReport): Promise<ModerationReport> {
    return this.write((data) => {
      data.reports.push(clone(report));
      return clone(report);
    });
  }

  listReports(status?: ModerationReport['status']): Promise<ModerationReport[]> {
    return this.read((data) =>
      clone(status ? data.reports.filter((report) => report.status === status) : data.reports),
    );
  }

  updateReport(id: string, patch: Partial<ModerationReport>): Promise<ModerationReport> {
    return this.write((data) => {
      const index = data.reports.findIndex((report) => report.id === id);
      if (index < 0) throw new Error(`Report ${id} not found`);
      const updated = { ...(data.reports[index] as ModerationReport), ...patch };
      data.reports[index] = updated;
      return clone(updated);
    });
  }

  blockPlayer(blockerId: string, blockedId: string): Promise<PlayerBlock> {
    return this.write((data) => {
      const existing = data.blocks.find(
        (block) => block.blockerId === blockerId && block.blockedId === blockedId,
      );
      if (existing) return clone(existing);
      const block: PlayerBlock = {
        blockerId,
        blockedId,
        createdAt: new Date().toISOString(),
      };
      data.blocks.push(block);
      return clone(block);
    });
  }

  unblockPlayer(blockerId: string, blockedId: string): Promise<void> {
    return this.write((data) => {
      data.blocks = data.blocks.filter(
        (block) => !(block.blockerId === blockerId && block.blockedId === blockedId),
      );
    });
  }

  listBlockedIds(playerId: string): Promise<string[]> {
    return this.read((data) =>
      data.blocks.filter((block) => block.blockerId === playerId).map((block) => block.blockedId),
    );
  }

  isEitherBlocked(a: string, b: string): Promise<boolean> {
    return this.read((data) =>
      data.blocks.some(
        (block) =>
          (block.blockerId === a && block.blockedId === b) ||
          (block.blockerId === b && block.blockedId === a),
      ),
    );
  }

  createNotification(notification: Notification): Promise<Notification> {
    return this.write((data) => {
      data.notifications.push(clone(notification));
      return clone(notification);
    });
  }

  listNotifications(playerId: string, limit = 50): Promise<Notification[]> {
    return this.read((data) =>
      clone(
        data.notifications
          .filter((entry) => entry.playerId === playerId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit),
      ),
    );
  }

  markNotificationsRead(playerId: string): Promise<void> {
    const now = new Date().toISOString();
    return this.write((data) => {
      for (const entry of data.notifications) {
        if (entry.playerId === playerId && !entry.readAt) entry.readAt = now;
      }
    });
  }

  listLinkedPlayers(): Promise<Player[]> {
    return this.read((data) =>
      clone(data.players.filter((player) => !player.isGuest && Boolean(player.email))),
    );
  }
}
