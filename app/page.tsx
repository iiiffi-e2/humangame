import Link from 'next/link';
import { DesktopNav } from '@/components/Chrome';
import { HomeTracker } from '@/features/home/HomeTracker';
import { ResetCountdown } from '@/features/home/ResetCountdown';
import { Avatar, LiveDot, StatCell, Wordmark } from '@/components/ui';
import { requirePlayer } from '@/lib/auth/session';
import { formatStamp } from '@/lib/daily/reset';
import { getHomeData } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * Home before play.
 *
 * One job: make the day feel live and get a thumb onto PLAY TODAY. Everything
 * else on the screen is evidence that other people are already playing —
 * yesterday's field, the streak on the line, and a Nemesis who has finished
 * but whose score stays sealed.
 */
export default async function HomePage() {
  const player = await requirePlayer();
  const data = await getHomeData(player);
  const nemesis = data.nemesis ?? data.friends.find((friend) => friend.played) ?? null;

  return (
    <>
      <DesktopNav
        dayNumber={data.dayNumber}
        date={data.date}
        resetInMs={data.resetInMs}
        displayName={player.displayName}
        active="today"
      />
      <HomeTracker dayNumber={data.dayNumber} hasPlayed={data.hasPlayed} streak={data.streak} />

      <div className="stage-grid">
        <aside className="stage-rail" aria-label="Live global stats">
          <div>
            <LiveDot label="Live · global" />
            <div className="num" style={{ fontSize: 96, marginTop: 12 }}>
              {data.todayPlayers.toLocaleString()}
            </div>
            <div className="mono" style={{ marginTop: 6 }}>
              humans have played today
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid var(--color-ink)', borderBottom: '1px solid var(--color-ink)' }}>
            <StatCell label="Median so far" value={(data.todayStats?.median ?? 0).toLocaleString()} />
            <div style={{ paddingLeft: 16, borderLeft: '1px solid var(--color-ink)' }}>
              <StatCell label="Perfect" value={data.todayStats?.perfect ?? 0} />
            </div>
          </div>
          <div>
            <div className="mono" style={{ opacity: 0.6, marginBottom: 12 }}>
              Score distribution · today
            </div>
            <Histogram buckets={data.todayStats?.histogram ?? []} />
          </div>
          <div style={{ flex: 1 }} />
          <p
            className="mono"
            style={{ opacity: 0.5, fontSize: 9, textTransform: 'none', letterSpacing: '0.02em', lineHeight: 1.5 }}
          >
            Same five events for everyone. Scores are deterministic; percentile settles as the day
            fills in.
          </p>
        </aside>

        <main id="main" className="phone">
          <div className="statusbar">
            <Link href="/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
              @{player.username ?? 'guest'}
            </Link>
            <span>
              #{data.dayNumber} &middot; {formatStamp(data.date)}
            </span>
          </div>

          <div
            className="pad"
            style={{ paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Wordmark />
            <LiveDot label={`${data.todayPlayers.toLocaleString()} live`} />
          </div>

          <div className="pad" style={{ paddingTop: 44 }}>
            <h1 className="disp" style={{ fontSize: 'min(58px, 14.5vw)', margin: 0 }}>
              How human are you today?
            </h1>
            <p style={{ margin: '18px 0 0', fontSize: 16, lineHeight: 1.35, maxWidth: 300, textWrap: 'pretty' }}>
              Five events. One official run. Everyone gets the same five.
            </p>
          </div>

          <div
            className="pad"
            style={{
              marginTop: 28,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              borderTop: '1px solid var(--color-ink)',
              borderBottom: '1px solid var(--color-ink)',
            }}
          >
            <StatCell
              label="Yesterday"
              value={(data.yesterday?.players ?? 0).toLocaleString()}
              note="players"
            />
            <div style={{ paddingLeft: 12, borderLeft: '1px solid var(--color-ink)' }}>
              <StatCell
                label="Median"
                value={(data.yesterday?.median ?? 0).toLocaleString()}
                note="/ 10,000"
              />
            </div>
            <div style={{ paddingLeft: 12, borderLeft: '1px solid var(--color-ink)' }}>
              <StatCell label="Perfect" value={data.yesterday?.perfect ?? 0} note="humans" />
            </div>
          </div>

          <div className="pad" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                border: '1px solid var(--color-ink)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="num" style={{ fontSize: 26 }}>
                  {data.streak}
                </span>
                <span className="mono">day streak</span>
              </span>
              <span className="mono" style={{ opacity: 0.6 }}>
                {data.hasPlayed ? 'Locked in today' : `Play to make ${data.streak + 1}`}
              </span>
            </div>

            {nemesis ? (
              <Link
                href={`/rivalry/${nemesis.playerId}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: 'var(--color-cobalt)',
                  color: '#fff',
                  textDecoration: 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      background: '#fff',
                      color: 'var(--color-cobalt)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                    aria-hidden
                  >
                    {nemesis.displayName[0]?.toUpperCase()}
                  </span>
                  <span>
                    <span style={{ fontWeight: 700, fontSize: 14, display: 'block' }}>
                      {nemesis.played
                        ? `${nemesis.displayName} has played today.`
                        : `${nemesis.displayName} hasn't played yet.`}
                    </span>
                    <span className="mono" style={{ opacity: 0.85, fontSize: 10, marginTop: 2, display: 'block' }}>
                      {data.hasPlayed && nemesis.score !== null
                        ? `${nemesis.score.toLocaleString()} today`
                        : 'Score hidden until you finish'}
                    </span>
                  </span>
                </span>
                {nemesis.seasonRecord ? (
                  <span className="mono">
                    {nemesis.seasonRecord[0]}&ndash;{nemesis.seasonRecord[1]}
                  </span>
                ) : null}
              </Link>
            ) : null}
          </div>

          <div style={{ flex: 1, minHeight: 24 }} />

          <div
            className="pad mono"
            style={{ paddingBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}
          >
            <span style={{ opacity: 0.6 }}>One ranked attempt. No retries.</span>
            <ResetCountdown initialMs={data.resetInMs} />
          </div>

          <div className="pad" style={{ paddingBottom: 28 }}>
            {data.hasPlayed && data.todayRunId ? (
              <Link
                href={`/result/${data.todayRunId}`}
                className="btn"
                style={{ minHeight: 72, fontSize: 22, textDecoration: 'none' }}
              >
                <span>See your result</span>
                <span className="mono" style={{ fontSize: 12 }}>
                  today &rarr;
                </span>
              </Link>
            ) : (
              <Link
                href="/play"
                className="btn btn-hi"
                style={{ minHeight: 72, fontSize: 22, textDecoration: 'none' }}
              >
                <span>Play today</span>
                <span className="mono" style={{ fontSize: 12, letterSpacing: '0.06em' }}>
                  ~75 sec &rarr;
                </span>
              </Link>
            )}
          </div>
        </main>

        <aside className="stage-rail" aria-label="Your people">
          {nemesis ? (
            <div style={{ padding: 16, background: 'var(--color-cobalt)', color: '#fff' }}>
              <div className="mono" style={{ opacity: 0.85 }}>
                Nemesis
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <Avatar name={nemesis.displayName} size={40} tone="gray" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {nemesis.played
                      ? `${nemesis.displayName} has played today.`
                      : `${nemesis.displayName} is still out there.`}
                  </div>
                  <div className="mono" style={{ opacity: 0.85, fontSize: 10, marginTop: 2 }}>
                    {data.hasPlayed ? 'Scores unlocked' : 'Score hidden until you finish'}
                    {nemesis.seasonRecord
                      ? ` · Season ${nemesis.seasonRecord[0]}–${nemesis.seasonRecord[1]}`
                      : ''}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <div
              className="mono"
              style={{ opacity: 0.6, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}
            >
              <span>Friends · today</span>
              <span>
                {data.friends.filter((friend) => friend.played).length} of {data.friends.length} played
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.friends.slice(0, 6).map((friend) => (
                <div
                  key={friend.playerId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr 72px',
                    gap: 10,
                    alignItems: 'center',
                    height: 48,
                    borderTop: '1px solid rgba(17,17,17,.15)',
                    opacity: friend.played ? 1 : 0.45,
                  }}
                >
                  <Avatar name={friend.displayName} size={28} tone={friend.isNemesis ? 'cobalt' : 'gray'} />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{friend.displayName}</span>
                  <span className="mono" style={{ textAlign: 'right', opacity: 0.6, fontSize: 10 }}>
                    {friend.played ? (friend.score?.toLocaleString() ?? '●●●●') : 'Not yet'}
                  </span>
                </div>
              ))}
              {data.friends.length === 0 ? (
                <p className="mono" style={{ opacity: 0.6, textTransform: 'none', lineHeight: 1.5 }}>
                  No rivals yet. Finish today and send someone the link.
                </p>
              ) : null}
            </div>
          </div>

          {data.crew ? (
            <div>
              <div className="mono" style={{ opacity: 0.6, marginBottom: 8 }}>
                Crew · {data.crew.crew.name}
              </div>
              <Link
                href={`/crew/${data.crew.crew.slug}`}
                style={{
                  padding: 14,
                  border: '1px solid var(--color-ink)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span>
                  <span className="num" style={{ fontSize: 32, display: 'block' }}>
                    {data.crew.playedToday}
                    <span style={{ opacity: 0.3 }}>/{data.crew.size}</span>
                  </span>
                  <span className="mono" style={{ fontSize: 9, marginTop: 2, display: 'block' }}>
                    played today
                  </span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span className="num" style={{ fontSize: 32, display: 'block' }}>
                    {data.crew.monthlyPlace ? ordinal(data.crew.monthlyPlace) : '—'}
                  </span>
                  <span className="mono" style={{ fontSize: 9, marginTop: 2, display: 'block' }}>
                    month standings
                  </span>
                </span>
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

function ordinal(value: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'][((value % 100) - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][value % 100] ?? 'th';
  return `${value}${suffix}`;
}

function Histogram({ buckets }: { buckets: number[] }) {
  const peak = Math.max(1, ...buckets);
  return (
    <>
      <div style={{ height: 140, display: 'flex', alignItems: 'flex-end', gap: 3 }} aria-hidden>
        {(buckets.length > 0 ? buckets : new Array(16).fill(0)).map((value, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: `${Math.max(1, (value / peak) * 100)}%`,
              background: 'var(--color-ink)',
              opacity: value === 0 ? 0.12 : 1,
            }}
          />
        ))}
      </div>
      <div
        className="mono"
        style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, opacity: 0.6 }}
      >
        <span>0</span>
        <span>5,000</span>
        <span>10,000</span>
      </div>
    </>
  );
}
