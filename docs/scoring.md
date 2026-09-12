# Scoring

Every event is worth an integer 0–2,000. A run is the sum, so 0–10,000. All of
it is a pure function of `(config, result)`, which is what lets the server
re-score without trusting the client and lets the unit tests pin the curves
exactly.

Nothing is ever scored from wall-clock network latency. Where a family uses
time, it is `performance.now()` measured inside the play field, submitted as a
duration.

---

## The five curves

### 1. Continuous error — `distanceScore`

For everything where the player aims at a value: a hold duration, a fill
level, an angle, a size.

```
error ≤ perfect                 → 1
error ≥ zero                    → 0
otherwise, t = (|error| − perfect) / (zero − perfect)
                                → (1 − t)^falloff
```

`falloff` defaults to 1.6, which is forgiving right around the target and then
falls away quickly. That shape is deliberate: the difference between 20ms and
40ms off should cost little, and the difference between 200ms and 400ms should
cost a lot, because only one of those is a skill gap.

Each family sets its own `perfect` and `zero` bands, and difficulty tightens
them. NERVE/DEAD STOP at difficulty 0 pays full marks inside 28ms and nothing
past 760ms; at difficulty 1, 16ms and 530ms.

### 2. Correct or not, plus speed — `categoricalScore`

For the BRAIN and MEMORY families with a right answer.

```
wrong  → wrongFloor (0 by default)
right  → (1 − speedWeight) + speedWeight × speedBonus
speedBonus = distanceScore(elapsed − par, perfect: 0, zero: slow − par, falloff: 1.1)
```

`speedWeight` is 0.28–0.32 depending on the family. The base is always the
larger share, which enforces the rule that **a fast wrong answer can never
beat a slow right one**. There is a unit test that says exactly that.

### 3. Sequences with partial credit — `sequenceScore`

For MEMORY/SEQUENCE and MEMORY/FLASH GRID.

```
positionCredit = length of the correct prefix / expected length
setCredit      = how many of the right items appear at all / expected length
score          = ((1 − setWeight) × positionCredit + setWeight × setCredit)
                 × lengthPenalty
```

`setWeight` is 0.25 for SEQUENCE (order is the point) and 1.0 for FLASH GRID
(order is meaningless — only the set of tiles matters). `lengthPenalty` scales
back an answer longer than the question, so tapping every tile is not a
strategy.

### 4. Orderings — `rankingScore`

For BRAIN/ORDER. Normalized Kendall tau: the share of item pairs placed in the
right relative order.

```
agreement = concordant pairs / total pairs        # 1 = perfect, 0 = reversed
agreement ≤ 0.5 → agreement × 0.4
agreement > 0.5 → 0.2 + (agreement − 0.5) × 1.6
```

Raw agreement is a bad payout curve, because a random shuffle of five items
averages 0.5 and half marks for guessing is not a score. The squeeze maps
random guessing to about 0.2 and keeps the top half of the range expressive: a
single adjacent swap (0.9 agreement) still pays about 0.84.

An answer with a missing or unknown id scores zero rather than throwing.

### 5. Percentage predictions — `percentageScore`

For EYE/PERCENT and CROWD/SPLIT: `distanceScore` on a 0–100 scale, with a
2-point perfect band and a zero point between 30 and 40 depending on
difficulty. Being 2 points out is a hit; being 40 out is a miss.

---

## Run total

```
totalScore(eventPoints, voidedIndexes)
```

Voided events are removed and the remainder is scaled back up, so **a day with
a voided event is still ranked out of 10,000**. Four perfect events with the
fifth voided is a perfect day. This is what makes voiding a defective event
safe to do mid-day: nobody's score collapses because a moderator pulled an
event.

---

## CROWD: blending a prior with the population

A CROWD event asks the player to predict what everyone else will do, so it
cannot be scored from the config alone. The first player of the day would be
scored against nothing, and the ten-thousandth against a completely different
distribution.

Each authored question carries a prior: expected shares plus a `weight`
expressed in pseudo-responses. The effective share of option *i* is

```
share(i) = (prior.shares[i] × prior.weight + counts[i]) / (prior.weight + total)
```

With no responses the prior is the answer. At `total = weight` the two
contribute equally. By ten times the weight the prior is worth under 10%. A
typical weight is 300–500, so a question settles into real data within the
first few thousand players and the prior only carries the first hour.

SPLIT blends a single number the same way, with live responses averaged in:

```
blended = (priorPercent × weight + Σ responses) / (weight + total)
```

### Alignment, not right-or-wrong

`crowdAlignment` scores how close the pick is to the crowd's choice, rather
than flagging it correct or incorrect:

```
MAJORITY:  (share(picked) / max share)^1.6
AVOID:     (min share / share(picked))^1.6
```

Picking an option that ties with the winner scores nearly full marks, which is
right — predicting a 50/49 split correctly is luck, and punishing the 49 like
the 5 would be noise dressed up as skill.

### Freezing

The points a player is shown at run completion are written into the run and
never recomputed. Their *percentile* keeps moving as the day fills in, and the
final aggregate is revealed separately once the distribution matures — but the
number on their card never changes underneath them.

---

## Labels

`tierFor(normalized)` maps quality to the word on the interstitial:

| Quality | Tier | Headline |
| --- | --- | --- |
| ≥ 0.995 | Flawless | Perfect. |
| ≥ 0.93 | Unreal | Nailed it. |
| ≥ 0.82 | Elite | Sharp. |
| ≥ 0.64 | Solid | Solid. |
| ≥ 0.42 | Human | Human. |
| ≥ 0.18 | Shaky | Shaky. |
| below | Cooked | Cooked. |

---

## Percentile and streaks

Percentile is defined in [`architecture.md`](architecture.md#percentile).

Streaks (`features/results/stats.ts`) are a pure reducer over finished runs.
Replaying the same date is a no-op, so a retried finish request cannot inflate
a streak. A streak is only shown as alive if the last run was today or
yesterday. Top-50 and top-10 streaks follow the same rule against percentile
thresholds of 50 and 90.

Crew months use placement points — 1st 10, 2nd 8, 3rd 6, 4th 5, 5th 4, and 2
for everyone else who played — which is why a member who turns up every day
and places mid-table beats someone who posts one huge score and disappears.
