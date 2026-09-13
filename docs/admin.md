# Admin guide

`/admin`, visible to a player whose row has `is_admin`, or whose claimed
handle or linked email appears in `HUMAN_ADMIN_USERNAMES` /
`HUMAN_ADMIN_EMAILS`. In development with neither set, the local guest is an
admin so the tools are reachable on a clean checkout. In production, set one
of them or nobody can get in.

## What the console shows

**Today.** Ranked runs, the score histogram, and per-event statistics: how
many people have played each event, the average points, and the spread. The
spread is the thing to look at. A healthy event has a wide distribution; an
event where almost everyone scores 0 or almost everyone scores 2,000 is
broken, and the histogram will show it long before anyone complains.

**Next 30 days.** Every upcoming day, frozen ones marked. Days that have not
been stored yet are previewed live from the seed — what you see is exactly
what will be generated.

**One day.** Its five events, the family for each, the difficulty, and a
digest of the config.

## Operations

### Before a day goes live

- **Replace a family.** Pick a different game for a pillar. The day keeps its
  seed, so only that pillar changes.
- **Regenerate.** Rebuild the whole day at the next version. Use this after
  changing content that the day draws on.
- **Freeze & publish.** Mark the day final. Frozen days refuse every edit
  except voiding.

### After a day has gone live

Frozen days are locked on purpose — a config that changes under players who
have already been scored against it is worse than any bug it would fix. Two
operations remain available:

- **Void an event.** The event stops counting for everyone. Runs are rescaled
  so the day is still out of 10,000: four perfect events with the fifth voided
  is still a perfect day. Players mid-run see the voided screen and continue;
  players who already finished keep their score, computed over the events that
  count.
- **Void the whole day.** Every event voided. Use this only when the day
  itself is unplayable.

Voiding is not retroactive punishment — nobody's score goes down because of
it, because the remaining events are scaled back up.

### Editing a CROWD prior

The `Prior` button on a CROWD event sets the prior weight for that day only,
writing into the stored manifest without touching the source content. Lower it
when the authored guess is clearly wrong and live data should take over
faster. See [`content-authoring.md`](content-authoring.md#setting-a-prior).

## When an event looks broken

1. **Look at the spread first.** One flat bar means everyone is getting the
   same score, which means the event is not measuring anything.
2. **Play it.** `/admin/practice` runs the same family on a random seed. Players never see that catalog.
3. **Void it** if it is genuinely unfair. It is cheap: the day survives.
4. **Fix the family**, then regenerate the *future* days that use it. Never
   edit a frozen past day.

## Moderation

Reports from `/profile/moderation` land in `moderation_reports` with status
`open`. Nothing is auto-actioned, and a report never affects the reported
player's score. Usernames are already constrained at creation — lowercase
letters, digits and underscores, 3–16 characters, with a reserved list — and
display names and crew names are stripped of control characters, zero-width
characters and bidi overrides, so the common leaderboard-defacing tricks do
not reach a row in the first place.

## Trust flags

A run carries `ok`, `suspect` or `excluded`. Suspect and excluded runs are
shadow-excluded: the player sees their score and keeps their streak, but the
run does not appear on public boards and does not contribute to anyone's
percentile. There is no ban hammer in this build, and adding one should be a
deliberate product decision rather than a threshold in a scoring file.
