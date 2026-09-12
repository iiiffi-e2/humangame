import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <span>HUMAN</span>
        <span className="mono">404</span>
      </div>
      <div className="pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 className="disp" style={{ fontSize: 'min(64px, 16vw)', margin: 0 }}>
          Nothing here.
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.4, marginTop: 18, opacity: 0.8, maxWidth: 320 }}>
          That link is expired, private, or was never real. Today&rsquo;s five are still waiting.
        </p>
      </div>
      <div className="pad" style={{ paddingBottom: 28 }}>
        <Link href="/" className="btn btn-hi" style={{ textDecoration: 'none' }}>
          <span>Play today</span>
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    </main>
  );
}
