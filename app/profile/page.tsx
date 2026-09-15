import { ProfileSettings } from '@/features/profile/ProfileSettings';
import { isAdmin, requirePlayer } from '@/lib/auth/session';
import { currentDateKey } from '@/lib/daily/reset';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const player = await requirePlayer();
  const store = getStore();
  const stats = await store.getStats(player.id);
  const notifications = await store.listNotifications(player.id, 20);
  return (
    <ProfileSettings
      player={{
        id: player.id,
        username: player.username,
        displayName: player.displayName,
        country: player.country,
        isGuest: player.isGuest,
        firstDayNumber: player.firstDayNumber,
        settings: player.settings,
      }}
      runsPlayed={stats?.runsPlayed ?? 0}
      today={currentDateKey()}
      isAdmin={isAdmin(player)}
      notifications={notifications}
    />
  );
}
