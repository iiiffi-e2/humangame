'use client';

import Link from 'next/link';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { BackLink } from '@/components/ui';
import type { ResultPayload } from '@/features/results/build';
import { track } from '@/lib/analytics';
import { apiPost } from '@/lib/client/api';
import { CARD_SIZES, drawCard, shareText, type CardFormat, type ShareCardData } from './card';

/**
 * Share card composer.
 *
 * The preview on screen is the real layout at 1/4 scale, not an
 * approximation: the same `drawCard` produces the pixels the player saves, so
 * what they see is what lands in the story.
 */
export function ShareComposer({
  payload,
  displayName,
  initialToken,
  siteUrl,
}: {
  payload: ResultPayload;
  displayName: string;
  initialToken: string | null;
  siteUrl: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [format, setFormat] = useState<CardFormat>('story');
  const [showPillars, setShowPillars] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const url = token ? `${siteUrl}/c/${token}` : siteUrl;

  const card: ShareCardData = useMemo(
    () => ({
      dayNumber: payload.dayNumber,
      totalScore: payload.totalScore,
      topPercent: payload.topPercent,
      percentile: payload.percentile,
      streak: payload.streak,
      pillars: payload.pillars.map((row) => ({ pillar: row.pillar, value: row.value })),
      rivalryLine: payload.rival
        ? `${displayName} ${payload.rival.seasonWinsViewer}–${payload.rival.seasonWinsRival} ${payload.rival.displayName}`
        : null,
      url,
      showPillars,
    }),
    [displayName, payload, showPillars, url],
  );

  const ensureToken = useCallback(async (): Promise<string> => {
    if (token) return token;
    const response = await apiPost<{ token: string }>('/api/challenge/create', {
      runId: payload.runId,
    });
    setToken(response.token);
    return response.token;
  }, [payload.runId, token]);

  const onShare = useCallback(async () => {
    setBusy(true);
    try {
      const freshToken = await ensureToken();
      const text = shareText({ ...card, url: `${siteUrl}/c/${freshToken}` });
      const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
      if (canShare) {
        await navigator.share({ title: `HUMAN #${payload.dayNumber}`, text });
        track('result_shared', { dayNumber: payload.dayNumber, surface: 'native' });
        setStatus('Shared.');
        return;
      }
      await navigator.clipboard.writeText(text);
      track('result_shared', { dayNumber: payload.dayNumber, surface: 'clipboard' });
      setStatus('Copied to your clipboard.');
    } catch (error) {
      // A cancelled native share is not a failure worth shouting about.
      setStatus(error instanceof Error && error.name === 'AbortError' ? null : 'Could not share.');
    } finally {
      setBusy(false);
    }
  }, [card, ensureToken, payload.dayNumber, siteUrl]);

  const onCopyLink = useCallback(async () => {
    setBusy(true);
    try {
      const freshToken = await ensureToken();
      await navigator.clipboard.writeText(`${siteUrl}/c/${freshToken}`);
      track('result_shared', { dayNumber: payload.dayNumber, surface: 'clipboard' });
      setStatus('Challenge link copied.');
    } catch {
      setStatus('Could not copy the link.');
    } finally {
      setBusy(false);
    }
  }, [ensureToken, payload.dayNumber, siteUrl]);

  const onSaveStory = useCallback(async () => {
    setBusy(true);
    try {
      const freshToken = await ensureToken();
      const size = CARD_SIZES[format];
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no canvas');
      drawCard(context, { ...card, url: `${siteUrl}/c/${freshToken}` }, size.width, size.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('no blob');
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `human-${payload.dayNumber}-${format}.png`;
      anchor.click();
      URL.revokeObjectURL(href);
      track('result_shared', { dayNumber: payload.dayNumber, surface: 'story' });
      setStatus('Saved.');
    } catch {
      setStatus('Could not build the image.');
    } finally {
      setBusy(false);
    }
  }, [card, ensureToken, format, payload.dayNumber, siteUrl]);

  const preview = CARD_SIZES[format];
  const previewWidth = 234;
  const previewHeight = Math.round((preview.height / preview.width) * previewWidth);

  return (
    <main id="main" className="phone">
      <div className="statusbar">
        <BackLink href={`/result/${payload.runId}`} label="Back" />
        <span className="mono">Share</span>
      </div>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '8px 24px 0' }}>
        <div
          style={{
            width: previewWidth,
            height: previewHeight,
            background: 'var(--color-ink)',
            color: 'var(--color-bone)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 0 var(--color-gray)',
          }}
          role="img"
          aria-label={`Share card: ${payload.totalScore} points, top ${payload.topPercent} percent`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="disp" style={{ fontSize: 18, letterSpacing: '-0.06em' }}>
              HUMAN
            </span>
            <span className="mono" style={{ fontSize: 8 }}>
              #{payload.dayNumber}
            </span>
          </div>
          <div className="num" style={{ fontSize: 78, color: 'var(--color-chartreuse)', marginTop: 22 }}>
            {payload.totalScore.toLocaleString()}
          </div>
          <div className="mono" style={{ fontSize: 9, marginTop: 4 }}>
            Top {payload.topPercent}% today
          </div>

          {showPillars ? (
            <div
              style={{
                marginTop: 18,
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: '5px 8px',
                alignItems: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.06em',
              }}
            >
              {payload.pillars.map((row) => (
                <Fragment key={row.pillar}>
                  <span>{row.pillar.toUpperCase()}</span>
                  <span style={{ height: 5, background: 'rgba(244,240,232,.15)', display: 'block' }}>
                    <span
                      style={{
                        display: 'block',
                        width: `${row.value}%`,
                        height: '100%',
                        background: 'var(--color-bone)',
                      }}
                    />
                  </span>
                  <span>{row.value}</span>
                </Fragment>
              ))}
            </div>
          ) : null}

          <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <span style={{ fontSize: 8 }}>{payload.streak} day streak</span>
            {card.rivalryLine ? (
              <span style={{ fontSize: 8, color: 'var(--color-cobalt-soft)' }}>{card.rivalryLine}</span>
            ) : null}
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            I beat {Math.round(payload.percentile)}% of humans today.
            <br />
            <span style={{ color: 'var(--color-chartreuse)' }}>Can you beat me?</span>
          </div>
          <div className="mono" style={{ fontSize: 7, opacity: 0.5, marginTop: 6 }}>
            {url.replace(/^https?:\/\//, '')}
          </div>
        </div>
      </div>

      <div className="pad mono" style={{ paddingTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['story', 'square', 'og'] as CardFormat[]).map((option) => (
          <button
            key={option}
            type="button"
            className="tap"
            aria-pressed={format === option}
            onClick={() => setFormat(option)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--color-ink)',
              background: format === option ? 'var(--color-ink)' : 'transparent',
              color: format === option ? 'var(--color-bone)' : 'inherit',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            {option === 'og' ? 'Link' : option}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="tap"
          aria-pressed={!showPillars}
          onClick={() => setShowPillars((current) => !current)}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--color-ink)',
            background: 'transparent',
            cursor: 'pointer',
            font: 'inherit',
            gap: 8,
          }}
        >
          {showPillars ? 'Hide bars' : 'Show bars'}
        </button>
      </div>

      {status ? (
        <p className="pad mono" role="status" style={{ paddingTop: 12, opacity: 0.7 }}>
          {status}
        </p>
      ) : null}

      <div
        className="pad"
        style={{ padding: '14px 24px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
      >
        <button
          type="button"
          className="btn btn-hi"
          style={{ gridColumn: '1 / -1' }}
          onClick={onShare}
          disabled={busy}
        >
          <span>Share</span>
          <span aria-hidden>&#8599;</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCopyLink} disabled={busy}>
          <span>Copy link</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSaveStory} disabled={busy}>
          <span>Save image</span>
        </button>
        <Link
          href="/leaderboards"
          className="btn btn-ghost"
          style={{ gridColumn: '1 / -1', textDecoration: 'none' }}
        >
          <span>Leaderboards</span>
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden />
    </main>
  );
}
