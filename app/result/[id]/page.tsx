import { notFound } from 'next/navigation';
import { FinalReveal } from '@/features/results/FinalReveal';
import { buildResultPayload } from '@/features/results/build';
import { requirePlayer } from '@/lib/auth/session';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Your result' };

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reveal?: string }>;
}) {
  const player = await requirePlayer();
  const { id } = await params;
  const { reveal } = await searchParams;

  const run = await getStore().getRun(id);
  if (!run || run.playerId !== player.id || run.status !== 'finished') notFound();

  const payload = await buildResultPayload(run, player);
  return (
    <FinalReveal
      payload={payload}
      animate={reveal === '1'}
      reducedMotion={player.settings.reduceMotion}
    />
  );
}
