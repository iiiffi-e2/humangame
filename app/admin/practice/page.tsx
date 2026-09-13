import { notFound } from 'next/navigation';
import { PracticeBoard } from '@/features/practice/PracticeBoard';
import { GAMES_BY_PILLAR } from '@/features/game-engine/registry';
import { PILLARS } from '@/features/game-engine/types';
import { isAdmin, requirePlayer } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin practice', robots: { index: false } };

export default async function AdminPracticePage() {
  const player = await requirePlayer();
  if (!isAdmin(player)) notFound();
  const families = PILLARS.flatMap((pillar) =>
    GAMES_BY_PILLAR[pillar].map((definition) => ({
      id: definition.id,
      name: definition.name,
      pillar: definition.pillar,
    })),
  );
  return <PracticeBoard families={families} reducedMotion={player.settings.reduceMotion} />;
}
