import type { Metadata } from 'next';
import { BackLink } from '@/components/ui';
import { LegalLinks } from '@/components/LegalLinks';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/" label="Back" />
        <span className="mono">Privacy</span>
      </div>
      <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
        <h1 className="disp" style={{ fontSize: 'min(48px, 12vw)', margin: 0 }}>
          Privacy
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.45, marginTop: 16, opacity: 0.85 }}>
          HUMAN is a game. Your score is not an IQ, a diagnosis, or a measure of anything about
          your health.
        </p>
        <section style={{ marginTop: 24 }}>
          <h2 className="mono" style={{ opacity: 0.5, fontWeight: 500 }}>
            Who can play
          </h2>
          <p style={body}>
            You must be at least 13. If you are under 18, a parent or guardian should know you
            are playing.
          </p>
        </section>
        <section style={{ marginTop: 22 }}>
          <h2 className="mono" style={{ opacity: 0.5, fontWeight: 500 }}>
            What we store
          </h2>
          <p style={body}>
            A signed guest cookie (`human_id`) identifies you so one official run a day can be
            enforced. We store your runs, streak, settings, optional username, optional linked
            email, rivalries, crews, and reports you file. The client never sends a score — the
            server recomputes it.
          </p>
        </section>
        <section style={{ marginTop: 22 }}>
          <h2 className="mono" style={{ opacity: 0.5, fontWeight: 500 }}>
            Who sees you
          </h2>
          <p style={body}>
            Privacy in Settings controls named leaderboards. Private keeps your name off every
            board; friends-only keeps it on friends, crews and rivalries; public is every board.
            Anonymous day stats still count your run so percentiles stay honest.
          </p>
        </section>
        <section style={{ marginTop: 22 }}>
          <h2 className="mono" style={{ opacity: 0.5, fontWeight: 500 }}>
            Deleting your data
          </h2>
          <p style={body}>
            Email the address on the account-link screen, or file a report from Settings, and
            ask us to delete your player row. Clearing the guest cookie starts a new identity on
            this device; it does not erase a linked account.
          </p>
        </section>
        <LegalLinks />
      </div>
    </main>
  );
}

const body: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
  marginTop: 10,
  opacity: 0.8,
  maxWidth: 340,
};
