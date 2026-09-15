import Link from 'next/link';

export function LegalLinks({ style }: { style?: React.CSSProperties }) {
  return (
    <p className="mono" style={{ opacity: 0.5, marginTop: 24, textTransform: 'none', ...style }}>
      <Link href="/privacy" style={{ color: 'inherit' }}>
        Privacy
      </Link>
      {' · '}
      <Link href="/terms" style={{ color: 'inherit' }}>
        Terms
      </Link>
    </p>
  );
}
