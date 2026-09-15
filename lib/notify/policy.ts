import type { PlayerSettings } from '@/lib/db/types';

export type NotificationKind =
  | 'rival_finished'
  | 'rival_beat_you'
  | 'rivalry_accepted'
  | 'crew_joined';

export type NotificationAudience = 'rival' | 'social';

export function notificationAudience(kind: NotificationKind): NotificationAudience {
  return kind === 'crew_joined' ? 'social' : 'rival';
}

export function shouldNotify(
  preference: PlayerSettings['notifications'],
  audience: NotificationAudience,
): boolean {
  if (preference === 'off') return false;
  if (preference === 'rivals') return audience === 'rival';
  return true;
}
