'use client';

import { useState } from 'react';
import { BackLink } from '@/components/ui';
import type { PlayerSettings } from '@/lib/db/types';
import { checkUsername } from '@/lib/auth/username';
import { track } from '@/lib/analytics';
import { apiPost } from '@/lib/client/api';

interface ProfilePlayer {
  id: string;
  username: string | null;
  displayName: string;
  country: string | null;
  isGuest: boolean;
  firstDayNumber: number;
  settings: PlayerSettings;
}

/**
 * Profile and settings.
 *
 * A guest can play forever without ever coming here. Claiming a handle is the
 * first commitment the product asks for, and it happens after a result, not
 * before one.
 */
export function ProfileSettings({
  player,
  runsPlayed,
  today,
}: {
  player: ProfilePlayer;
  runsPlayed: number;
  today: string;
}) {
  const [username, setUsername] = useState(player.username ?? '');
  const [displayName, setDisplayName] = useState(player.displayName);
  const [settings, setSettings] = useState(player.settings);
  const [claimed, setClaimed] = useState(Boolean(player.username));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usernameCheck = checkUsername(username || 'aaa');

  const claim = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await apiPost('/api/player/username', { username, displayName });
      setClaimed(true);
      track('username_claimed', { dayNumber: 0 });
      setMessage('Handle claimed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not claim that.');
    } finally {
      setBusy(false);
    }
  };

  const save = async (patch: Partial<PlayerSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    // The motion preference has to bite immediately, not on the next render.
    if (patch.reduceMotion !== undefined) {
      document.documentElement.dataset.reduceMotion = patch.reduceMotion ? 'true' : 'false';
    }
    try {
      await apiPost('/api/player/settings', { settings: patch, displayName });
    } catch {
      setMessage('Could not save that setting.');
    }
  };

  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/" label="Back" />
        <span className="mono">Settings</span>
      </div>

      <div className="pad" style={{ paddingTop: 8, display: 'flex', gap: 14, alignItems: 'center' }}>
        <span
          style={{
            width: 64,
            height: 64,
            background: 'var(--color-ink)',
            color: 'var(--color-chartreuse)',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 28,
          }}
          aria-hidden
        >
          {displayName[0]?.toUpperCase() ?? '?'}
        </span>
        <div>
          <div className="disp" style={{ fontSize: 30 }}>
            {displayName}
          </div>
          <div className="mono" style={{ opacity: 0.6, marginTop: 4 }}>
            {player.username ? `@${player.username}` : 'Guest'} &middot; since #{player.firstDayNumber}
            {runsPlayed > 0 ? ` · ${runsPlayed} runs` : ''}
          </div>
        </div>
      </div>

      {message ? (
        <p className="pad mono" role="status" style={{ paddingTop: 14, opacity: 0.75, textTransform: 'none' }}>
          {message}
        </p>
      ) : null}

      <section className="pad" style={{ marginTop: 24 }}>
        <h2 className="mono" style={{ opacity: 0.5, paddingBottom: 8, margin: 0, fontWeight: 500 }}>
          Identity
        </h2>

        <div style={{ borderTop: '1px solid rgba(17,17,17,.2)', paddingTop: 12 }}>
          <label className="mono" htmlFor="username" style={{ display: 'block', marginBottom: 8, opacity: 0.7 }}>
            Username
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="ericplays"
              maxLength={16}
              autoComplete="username"
              style={inputStyle}
            />
            <button
              type="button"
              className="btn btn-hi"
              style={{ width: 120 }}
              disabled={busy || !usernameCheck.ok || username.length < 3}
              onClick={claim}
            >
              <span>{claimed ? 'Update' : 'Claim'}</span>
            </button>
          </div>
          {username.length >= 3 && !usernameCheck.ok ? (
            <p className="mono" style={{ color: 'var(--color-coral)', marginTop: 8, textTransform: 'none' }}>
              {usernameCheck.error}
            </p>
          ) : null}
        </div>

        <div style={{ borderTop: '1px solid rgba(17,17,17,.2)', paddingTop: 12, marginTop: 16 }}>
          <label className="mono" htmlFor="display-name" style={{ display: 'block', marginBottom: 8, opacity: 0.7 }}>
            Display name
          </label>
          <input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            onBlur={() => void save({})}
            maxLength={24}
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>

        <Row
          label="Account"
          value={player.isGuest ? 'Guest · link to save' : 'Linked'}
          tone={player.isGuest ? 'coral' : undefined}
          href="/profile/link"
        />
      </section>

      <section className="pad" style={{ marginTop: 22 }}>
        <h2 className="mono" style={{ opacity: 0.5, paddingBottom: 8, margin: 0, fontWeight: 500 }}>
          Play
        </h2>
        <Toggle label="Sound" checked={settings.sound} onChange={(value) => save({ sound: value })} />
        <Toggle label="Haptics" checked={settings.haptics} onChange={(value) => save({ haptics: value })} />
        <Toggle
          label="Reduce motion"
          checked={settings.reduceMotion}
          onChange={(value) => save({ reduceMotion: value })}
        />
      </section>

      <section className="pad" style={{ marginTop: 22, paddingBottom: 28 }}>
        <h2 className="mono" style={{ opacity: 0.5, paddingBottom: 8, margin: 0, fontWeight: 500 }}>
          People
        </h2>
        <Select
          label="Notifications"
          value={settings.notifications}
          options={[
            ['off', 'Off'],
            ['rivals', 'Rivals only'],
            ['all', 'Everything'],
          ]}
          onChange={(value) => save({ notifications: value as PlayerSettings['notifications'] })}
        />
        <Select
          label="Privacy"
          value={settings.privacy}
          options={[
            ['private', 'Nobody sees my scores'],
            ['friends', 'Friends see me'],
            ['public', 'Public boards'],
          ]}
          onChange={(value) => save({ privacy: value as PlayerSettings['privacy'] })}
        />
        <Row label="Blocked & reports" value="Manage" href="/profile/moderation" />
        <p className="mono" style={{ opacity: 0.45, marginTop: 24, textTransform: 'none', lineHeight: 1.6 }}>
          HUMAN is a game. Your score is not an IQ, a diagnosis, or a measure of anything about your
          health. Day {today}.
        </p>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 56,
  padding: '0 14px',
  border: '2px solid var(--color-ink)',
  background: 'transparent',
  fontFamily: 'var(--font-mono)',
  fontSize: 16,
  color: 'inherit',
};

function Row({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  tone?: 'coral';
}) {
  const content = (
    <>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
      <span className="mono" style={{ color: tone === 'coral' ? 'var(--color-coral)' : undefined }}>
        {value} &rsaquo;
      </span>
    </>
  );
  const style: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    borderTop: '1px solid rgba(17,17,17,.2)',
    color: 'inherit',
    textDecoration: 'none',
  };
  return href ? (
    <a href={href} style={style}>
      {content}
    </a>
  ) : (
    <div style={style}>{content}</div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 52,
        borderTop: '1px solid rgba(17,17,17,.2)',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span className="mono" style={{ opacity: 0.6 }}>
          {checked ? 'On' : 'Off'}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          style={{ width: 24, height: 24, accentColor: 'var(--color-ink)' }}
        />
      </span>
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 52,
        borderTop: '1px solid rgba(17,17,17,.2)',
        gap: 12,
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          minHeight: 44,
          border: '1px solid var(--color-ink)',
          background: 'transparent',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          padding: '0 8px',
          color: 'inherit',
        }}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
