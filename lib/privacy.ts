import type { PlayerSettings } from '@/lib/db/types';

export type NamedBoard = 'global' | 'country' | 'month' | 'friends' | 'crews' | 'rivalry';

const SOCIAL_BOARDS: NamedBoard[] = ['friends', 'crews', 'rivalry'];

/**
 * Whether a player’s identity may appear on a named board.
 *
 * Anonymous percentile math still counts everyone — this only hides the name.
 */
export function visibleOnNamedBoard(
  privacy: PlayerSettings['privacy'],
  board: NamedBoard,
  flags: { hiddenFromBoards?: boolean; isViewer?: boolean } = {},
): boolean {
  if (flags.isViewer) return true;
  if (flags.hiddenFromBoards && !SOCIAL_BOARDS.includes(board)) return false;
  if (privacy === 'private') return false;
  if (privacy === 'friends') return SOCIAL_BOARDS.includes(board);
  return true;
}
