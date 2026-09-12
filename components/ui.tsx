import Link from 'next/link';
import type { Pillar } from '@/features/game-engine/types';

/**
 * The shared vocabulary of the interface: wordmark, status bar, rules,
 * numbers, avatars, pillar bars. Everything else composes these.
 */

export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <span className="disp" style={{ fontSize: size, letterSpacing: '-0.06em' }}>
      HUMAN
    </span>
  );
}

export function StatusBar({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="statusbar">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

export function LiveDot({ label }: { label: string }) {
  return (
    <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          background: 'var(--color-chartreuse)',
          border: '1px solid currentColor',
          borderRadius: '50%',
        }}
      />
      {label}
    </span>
  );
}

export function Avatar({
  name,
  size = 32,
  tone = 'ink',
  dashed = false,
}: {
  name: string;
  size?: number;
  tone?: 'ink' | 'cobalt' | 'gray';
  dashed?: boolean;
}) {
  const palette = {
    ink: { background: 'var(--color-ink)', color: 'var(--color-chartreuse)' },
    cobalt: { background: 'var(--color-cobalt)', color: '#fff' },
    gray: { background: 'var(--color-gray)', color: 'var(--color-ink)' },
  }[tone];

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        fontSize: Math.round(size * 0.44),
        flex: 'none',
        ...(dashed
          ? { border: '1px dashed currentColor', background: 'transparent', color: 'inherit' }
          : palette),
      }}
    >
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

export function StatCell({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  accent?: string;
}) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div className="mono" style={{ opacity: 0.6 }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 30, marginTop: 6, color: accent }}>
        {value}
      </div>
      {note ? (
        <div className="mono" style={{ marginTop: 4, fontSize: 10, opacity: 0.7 }}>
          {note}
        </div>
      ) : null}
    </div>
  );
}

const PILLAR_NAME: Record<Pillar, string> = {
  nerve: 'Nerve',
  eye: 'Eye',
  memory: 'Memory',
  brain: 'Brain',
  crowd: 'Crowd',
};

export function PillarBar({
  pillar,
  value,
  best,
  onDark = false,
}: {
  pillar: Pillar;
  /** 0..100. */
  value: number;
  /** Highlight this row as the player's strongest. */
  best?: boolean;
  onDark?: boolean;
}) {
  const track = onDark ? 'rgba(244,240,232,.15)' : 'rgba(17,17,17,.12)';
  const fill = best ? 'var(--color-chartreuse)' : onDark ? 'var(--color-bone)' : 'var(--color-ink)';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 1fr 40px',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <span className="mono" style={{ color: best ? 'var(--color-chartreuse)' : undefined }}>
        {PILLAR_NAME[pillar]}
      </span>
      <div style={{ height: 12, background: track }}>
        <div
          className="anim-bar"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: fill }}
        />
      </div>
      <span
        className="num"
        style={{
          fontSize: 20,
          textAlign: 'right',
          color: best ? 'var(--color-chartreuse)' : undefined,
        }}
      >
        {value}
      </span>
      <span className="sr-only">
        {PILLAR_NAME[pillar]}: {value} out of 100
      </span>
    </div>
  );
}

export function ProgressPips({
  total,
  current,
  onDark = false,
}: {
  total: number;
  current: number;
  onDark?: boolean;
}) {
  return (
    <div className="pad" style={{ display: 'flex', gap: 4 }} aria-hidden>
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          style={{
            flex: 1,
            height: 3,
            background: index === current && onDark ? 'var(--color-chartreuse)' : 'currentColor',
            opacity: index <= current ? 1 : 0.15,
          }}
        />
      ))}
    </div>
  );
}

export function Spacer() {
  return <div style={{ flex: 1 }} />;
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="tap" style={{ textDecoration: 'none', color: 'inherit' }}>
      <span aria-hidden>&larr;&nbsp;</span>
      {label}
    </Link>
  );
}

export function Badge({
  children,
  tone = 'chartreuse',
}: {
  children: React.ReactNode;
  tone?: 'chartreuse' | 'ink' | 'coral' | 'cobalt';
}) {
  const palette = {
    chartreuse: { background: 'var(--color-chartreuse)', color: 'var(--color-ink)' },
    ink: { background: 'var(--color-ink)', color: 'var(--color-bone)' },
    coral: { background: 'var(--color-coral)', color: 'var(--color-ink)' },
    cobalt: { background: 'var(--color-cobalt)', color: '#fff' },
  }[tone];
  return (
    <span className="mono" style={{ padding: '4px 8px', ...palette }}>
      {children}
    </span>
  );
}
