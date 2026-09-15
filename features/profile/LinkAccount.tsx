'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BackLink } from '@/components/ui';
import { apiPost } from '@/lib/client/api';

type Stage = 'idle' | 'sent' | 'linked';

/**
 * Link a guest to a real account.
 *
 * With Supabase configured this sends a one-time code by email and, once the
 * browser holds a session, hands the access token to the server, which
 * attaches it to the *existing* player row — the runs, streak and rivalries
 * all survive.
 *
 * Without a provider configured (a clean checkout) the same form takes a
 * dev-mode path so the flow can be exercised end to end locally. That path is
 * refused in production.
 */
export function LinkAccount({
  isGuest,
  email,
  provider,
  supabaseConfigured,
  supabaseUrl,
  supabaseAnonKey,
  devMode,
}: {
  isGuest: boolean;
  email: string | null;
  provider: string;
  supabaseConfigured: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  devMode: boolean;
}) {
  const [address, setAddress] = useState(email ?? '');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>(isGuest ? 'idle' : 'linked');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured || !isGuest) return;
    void (async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl, supabaseAnonKey);
      const { data } = await client.auth.getSession();
      if (!data.session) return;
      try {
        await apiPost('/api/auth/link', { accessToken: data.session.access_token });
        setStage('linked');
        setMessage('Linked. Your runs travel with you now.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Could not finish linking.');
      }
    })();
  }, [isGuest, supabaseAnonKey, supabaseConfigured, supabaseUrl]);

  const oauth = async (provider: 'google' | 'apple') => {
    setBusy(true);
    setMessage(null);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl, supabaseAnonKey);
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/profile/link` },
      });
      if (error) throw new Error(error.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start that sign-in.');
      setBusy(false);
    }
  };

  const sendCode = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!supabaseConfigured) {
        await apiPost('/api/auth/link', { email: address });
        setStage('linked');
        setMessage('Linked in dev mode. Configure Supabase for real sign-in.');
        return;
      }
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl, supabaseAnonKey);
      const { error } = await client.auth.signInWithOtp({ email: address });
      if (error) throw new Error(error.message);
      setStage('sent');
      setMessage('Check your email for a six-digit code.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send that.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await client.auth.verifyOtp({
        email: address,
        token: code,
        type: 'email',
      });
      if (error || !data.session) throw new Error(error?.message ?? 'That code did not work.');
      await apiPost('/api/auth/link', { accessToken: data.session.access_token });
      setStage('linked');
      setMessage('Linked. Your runs travel with you now.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not verify that.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href="/profile" label="Settings" />
        <span className="mono">Account</span>
      </div>

      <div className="pad" style={{ paddingTop: 8 }}>
        <h1 className="disp" style={{ fontSize: 'min(48px, 12vw)', margin: 0 }}>
          {stage === 'linked' ? 'Account linked.' : 'Keep your record.'}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.4, marginTop: 16, opacity: 0.8, maxWidth: 330 }}>
          {stage === 'linked'
            ? `Signed in with ${provider}${email ? ` as ${email}` : ''}. Your streak, rivalries and every run you have played stay attached to this account.`
            : 'You have been playing as a guest, which works fine — until you change phone. Link an account and every run, streak and rivalry comes with you.'}
        </p>
      </div>

      {message ? (
        <p className="pad mono" role="status" style={{ paddingTop: 16, opacity: 0.8, textTransform: 'none' }}>
          {message}
        </p>
      ) : null}

      {stage !== 'linked' ? (
        <div className="pad" style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="mono" htmlFor="email" style={{ opacity: 0.6 }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />

          {stage === 'sent' ? (
            <>
              <label className="mono" htmlFor="code" style={{ opacity: 0.6 }}>
                Six-digit code
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="000000"
                maxLength={8}
                style={inputStyle}
              />
              <button type="button" className="btn btn-hi" disabled={busy || code.length < 6} onClick={verify}>
                <span>Verify &amp; link</span>
                <span aria-hidden>&rarr;</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-hi"
              disabled={busy || !address.includes('@')}
              onClick={sendCode}
            >
              <span>{supabaseConfigured ? 'Send me a code' : 'Link (dev mode)'}</span>
              <span aria-hidden>&rarr;</span>
            </button>
          )}

          {supabaseConfigured ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <button type="button" className="btn" disabled={busy} onClick={() => void oauth('google')}>
                <span>Continue with Google</span>
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void oauth('apple')}>
                <span>Continue with Apple</span>
              </button>
            </div>
          ) : (
            <p className="mono" style={{ opacity: 0.55, textTransform: 'none', letterSpacing: '0.02em', lineHeight: 1.6 }}>
              {devMode
                ? 'No auth provider is configured, so this uses the documented dev-mode path. Set NEXT_PUBLIC_SUPABASE_URL and the keys to enable email, Google, Apple or passkeys.'
                : 'No sign-in provider is configured on this deployment.'}
            </p>
          )}
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 24 }} />

      <div className="pad" style={{ paddingBottom: 28 }}>
        <Link className="btn btn-ghost" href="/profile" style={{ textDecoration: 'none' }}>
          <span>Back to settings</span>
        </Link>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  minHeight: 56,
  padding: '0 14px',
  border: '2px solid var(--color-ink)',
  background: 'transparent',
  fontFamily: 'var(--font-mono)',
  fontSize: 16,
  color: 'inherit',
};
