import { RunShell } from '@/features/game-engine/RunShell';
import { requirePlayer } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Official run' };

/**
 * The official run. Everything from here on is client-driven, because the
 * timing of a hold or a tap has to be measured in the same frame loop that
 * drew it.
 */
export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const player = await requirePlayer();
  const params = await searchParams;
  return (
    <RunShell
      challengeToken={params.c ?? null}
      reducedMotion={player.settings.reduceMotion}
    />
  );
}
