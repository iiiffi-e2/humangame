import { notFound } from 'next/navigation';
import { AdminReports } from '@/features/admin/AdminReports';
import { isAdmin, requirePlayer } from '@/lib/auth/session';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reports', robots: { index: false } };

export default async function AdminReportsPage() {
  const player = await requirePlayer();
  if (!isAdmin(player)) notFound();
  const reports = await getStore().listReports();
  return <AdminReports reports={reports} />;
}
