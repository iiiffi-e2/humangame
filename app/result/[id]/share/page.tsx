import { notFound } from 'next/navigation';
import { ShareComposer } from '@/features/challenges/ShareComposer';
import { buildResultPayload } from '@/features/results/build';
import { requirePlayer } from '@/lib/auth/session';
import { getStore } from '@/lib/db';
import { publicEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Share' };

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const player = await requirePlayer();
  const { id } = await params;

  const store = getStore();
  const run = await store.getRun(id);
  if (!run || run.playerId !== player.id || run.status !== 'finished') notFound();

  const payload = await buildResultPayload(run, player);
  const existing = await store.getChallengeForRun(run.id);

  return (
    <ShareComposer
      payload={payload}
      displayName={player.displayName}
      initialToken={existing?.token ?? null}
      siteUrl={publicEnv.siteUrl}
    />
  );
}
