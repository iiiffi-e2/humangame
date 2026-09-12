import { ReportForm } from '@/features/profile/ReportForm';
import { BackLink } from '@/components/ui';
import { requirePlayer } from '@/lib/auth/session';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Blocked and reports' };

/**
 * Moderation. Reports go to a human queue — nothing here auto-bans anyone,
 * and a report never affects the reported player's score.
 */
export default async function ModerationPage() {
  const player = await requirePlayer();
  const reports = (await getStore().listReports()).filter(
    (report) => report.reporterId === player.id,
  );

  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/profile" label="Settings" />
        <span className="mono">Reports</span>
      </div>

      <div className="pad" style={{ paddingTop: 8 }}>
        <h1 className="disp" style={{ fontSize: 'min(44px, 11vw)', margin: 0 }}>
          Blocked &amp; reports
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.45, marginTop: 14, opacity: 0.8, maxWidth: 330 }}>
          Report a username or a crew name that should not be on a leaderboard. A person reads every
          one of these.
        </p>
      </div>

      <ReportForm />

      <section className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
        <h2 className="mono" style={{ opacity: 0.5, fontWeight: 500 }}>
          Your reports
        </h2>
        {reports.length === 0 ? (
          <p className="mono" style={{ opacity: 0.6, textTransform: 'none', marginTop: 12 }}>
            Nothing reported.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
            {reports.map((report) => (
              <li
                key={report.id}
                style={{
                  borderTop: '1px solid rgba(17,17,17,.2)',
                  padding: '12px 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 14 }}>
                  {report.subjectType} · {report.subjectId}
                  <span style={{ display: 'block', opacity: 0.6, fontSize: 12, marginTop: 2 }}>
                    {report.reason}
                  </span>
                </span>
                <span className="mono" style={{ opacity: 0.6 }}>
                  {report.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
