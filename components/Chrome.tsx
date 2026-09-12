import Link from 'next/link';
import { Avatar, Wordmark } from '@/components/ui';
import { formatCountdown, formatStamp } from '@/lib/daily/reset';

/**
 * The desktop header. Hidden below the stage breakpoint, where the phone
 * layout is the whole product and chrome would only steal thumb space.
 */
export function DesktopNav({
  dayNumber,
  date,
  resetInMs,
  displayName,
  active,
}: {
  dayNumber: number;
  date: string;
  resetInMs: number;
  displayName: string;
  active: 'today' | 'leaderboards' | 'crews' | 'history';
}) {
  const links: Array<[typeof active, string, string]> = [
    ['today', 'Today', '/'],
    ['leaderboards', 'Leaderboards', '/leaderboards'],
    ['crews', 'Crews', '/crews'],
    ['history', 'History', '/history'],
  ];

  return (
    <header
      className="desktop-nav"
      style={{
        display: 'none',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 40px',
        height: 64,
        borderBottom: '1px solid var(--color-ink)',
      }}
    >
      <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <Wordmark size={30} />
      </Link>
      <nav className="mono" style={{ display: 'flex', gap: 28 }}>
        {links.map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              opacity: key === active ? 1 : 0.6,
              borderBottom: key === active ? '2px solid currentColor' : '2px solid transparent',
              paddingBottom: 2,
            }}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mono" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span>
          #{dayNumber} &middot; {formatStamp(date)} &middot; resets {formatCountdown(resetInMs)}
        </span>
        <Link href="/profile" aria-label="Profile and settings" className="tap">
          <Avatar name={displayName} size={32} />
        </Link>
      </div>
    </header>
  );
}
