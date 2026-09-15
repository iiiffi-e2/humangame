import type { Metadata } from 'next';
import { BackLink } from '@/components/ui';
import { LegalLinks } from '@/components/LegalLinks';

export const metadata: Metadata = { title: 'Terms' };

export default function TermsPage() {
  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/" label="Back" />
        <span className="mono">Terms</span>
      </div>
      <div className="pad" style={{ paddingTop: 8, paddingBottom: 28 }}>
        <h1 className="disp" style={{ fontSize: 'min(48px, 12vw)', margin: 0 }}>
          Terms
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.45, marginTop: 16, opacity: 0.85 }}>
          HUMAN is a daily game. It is not an IQ test, a cognitive assessment, or medical
          advice.
        </p>
        <section style={{ marginTop: 24 }}>
          <h2 className="mono" style={{ opacity: 0.5, fontWeight: 500 }}>
            The rules
          </h2>
          <p style={body}>
            Everyone gets the same five events each day and exactly one official ranked run.
            Practice after that run is unofficial and never writes to a leaderboard. Cheating,
            harassment, and impersonation can get a name hidden from boards.
          </p>
        </section>
        <section style={{ marginTop: 22 }}>
          <h2 className="mono" style={{ opacity: 0.5, fontWeight: 500 }}>
            Age
          </h2>
          <p style={body}>
            You must be 13 or older to play. Accounts for children under 13 are not allowed.
          </p>
        </section>
        <section style={{ marginTop: 22 }}>
          <h2 className="mono" style={{ opacity: 0.5, fontWeight: 500 }}>
            Your content
          </h2>
          <p style={body}>
            Usernames, crew names and reports must not include hate, sexual content involving
            minors, or anyone else’s personal information. We may hide or remove them.
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
