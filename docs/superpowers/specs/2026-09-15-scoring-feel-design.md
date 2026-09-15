# Scoring feel: time, copy, and honest fields

Shared daily stays. Rivalry and crew boards stay comparable. Copying
becomes harder, not impossible.

## Player-facing rule

One sentence, on every non-Nerve event:

**How close you were, then how long you took — closeness counts more.**

Nerve is unchanged: the clock already *is* the puzzle.

## Speed multiplier

New primitive `applySpeed(accuracy, { elapsedMs, parMs, slowMs, speedWeight })`:

```
speedBonus = distanceScore(elapsed − par, perfect: 0, zero: slow − par, falloff: 1.1)
quality    = accuracy × ((1 − speedWeight) + speedWeight × speedBonus)
```

- Accuracy 0 stays 0. Fast and wrong still loses to slow and right.
- At or under par, quality equals accuracy.
- At or past slow, quality is `accuracy × (1 − speedWeight)`.
- Default `speedWeight` is 0.28, so a slow perfect pays 1,440 / 2,000.

`categoricalScore` is this formula with accuracy 0 or 1. Brain Next / Rotate
and Memory / What moved already use it; they keep their own par/slow bands.

Elapsed time is `performance.now()` inside the play field, never network
latency. Missing `elapsedMs` on a result is treated as `slowMs` (no bonus),
so an old client cannot mint a perfect by omitting the clock.

### Bands

| Family | Clock starts | par | slow | weight |
| --- | --- | --- | --- | --- |
| Eye (percent, half, angle) | field mount | 5s | 22s | 0.28 |
| Memory flash grid / sequence | recall phase (after the flash/playback) | 8s | 25s | 0.28 |
| Brain order | field mount | 12s | 40s | 0.25 |
| Crowd (majority, avoid, split) | field mount | 5s | 20s | 0.25 |

What moved / Next / Rotate keep the bands they already have.

A day frozen before this change has no `parMs` on the config. Scoring reads
the bands from the family constants, not from stored config, so old days
re-score the same way as new ones.

## Fields that were counting, not estimating

- **Percent:** remove on-screen + / −. Drag the fill, then Lock. No printed
  current %. Keyboard arrows stay (accessibility).
- **Angle:** remove + / −. Hide the live degree number in the dial. The ray
  is the answer; the headline still names the target. Keyboard arrows stay.
- **Half:** keep the nudge buttons. There is no number to count to.
- **Split:** keep the big percentage. That number *is* the call, not a leak
  of a hidden target.

## Result card (mid-run)

Nerve still shows the exact miss (`40 ms late`, `1.2 off`).

Every other family shows two chips, never the copyable measurement:

| Chip | Values |
| --- | --- |
| Closeness | Spot on / Close / Off / Missed (from accuracy, before speed) |
| Pace | Quick / On pace / A bit slow / Slow |

Exact lines like `2.0% off`, `3 in a row`, `62% went there` wait until the
run is over.

## Final reveal

Each pillar row keeps the 0–100 bar and gains the exact metric underneath,
now that the player has finished and a spectator mid-run can no longer use
it. Stored `rawMetric` + `gameId` are enough; nothing is recomputed.

## Out of scope

- Per-player puzzles
- Changing Nerve curves
- Changing the 0–2,000 / 0–10,000 caps
- Changing crowd blending or frozen points
