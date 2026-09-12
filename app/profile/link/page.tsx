import { LinkAccount } from '@/features/profile/LinkAccount';
import { requirePlayer } from '@/lib/auth/session';
import { hasSupabase, publicEnv, serverEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Link your account' };

/**
 * Account linking, offered after a result rather than before one. A guest
 * already owns their runs; linking is about keeping them when the device
 * changes, not about gaining permission to play.
 */
export default async function LinkAccountPage() {
  const player = await requirePlayer();
  return (
    <LinkAccount
      isGuest={player.isGuest}
      email={player.email}
      provider={player.authProvider}
      supabaseConfigured={hasSupabase()}
      supabaseUrl={publicEnv.supabaseUrl}
      supabaseAnonKey={publicEnv.supabaseAnonKey}
      devMode={!serverEnv().isProduction}
    />
  );
}
