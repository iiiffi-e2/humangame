import { randomUUID } from 'node:crypto';
import { getStore } from '@/lib/db';
import type { Notification, NotificationKind, Player } from '@/lib/db/types';
import { notificationAudience, shouldNotify } from './policy';

export async function notifyPlayer(
  player: Player,
  input: { kind: NotificationKind; body: string; href?: string | null },
): Promise<Notification | null> {
  if (!shouldNotify(player.settings.notifications, notificationAudience(input.kind))) {
    return null;
  }
  return getStore().createNotification({
    id: randomUUID(),
    playerId: player.id,
    kind: input.kind,
    body: input.body,
    href: input.href ?? null,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
}
