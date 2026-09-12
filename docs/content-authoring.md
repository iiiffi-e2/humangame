# Authoring content

Two families need written content: **BRAIN / ORDER** (a set of five things to
rank) and the three **CROWD** families (a question plus a prior). Everything
else is generated.

## ORDER sets

`features/games/brain/content.ts`

```ts
{
  id: 'population',
  prompt: 'Smallest → largest.',
  hint: 'By population.',
  items: [
    { id: 'iceland',  label: 'Iceland',     value: 0.39 },
    …five items total, `value` is the sort key…
  ],
}
```

Rules that keep a set fair:

- **Five items, one unambiguous ordering.** If two items are within a few
  percent of each other, a player who knows the answer still gets it wrong.
  Spread the values.
- **No specialist knowledge.** A player should be able to reason to the
  ordering from things they already half-know. "Distance from the Sun" is
  fine; "atomic radius" is not.
- **Labels short enough to read at a glance** — they sit on a 64px row on a
  390px phone.
- **The `value` is never shown.** It only sorts. Use whatever unit is natural.
- **`prompt` states the direction explicitly** ("Smallest → largest",
  "Oldest → newest"). Never make the player guess which way round it is.

The generator scrambles the items and re-scrambles if the shuffle happens to
land on the solution.

## CROWD questions

`features/games/crowd/content.ts`

### MAJORITY and AVOID

```ts
{
  id: 'window-aisle',
  question: 'Which seat will most players pick?',
  options: [{ id: 'window', label: 'Window' }, …],
  priorShares: { window: 0.55, aisle: 0.41, middle: 0.04 },
  priorWeight: 400,
}
```

- **Three options for MAJORITY, four for AVOID.** AVOID needs enough room for
  a genuinely lonely answer to exist.
- **The question asks about other people, not the player.** "Which seat will
  most players pick?" — not "which seat do you prefer?". The whole pillar
  falls apart if people answer for themselves.
- **No option should be obviously dominant.** A 90/5/5 split is not a
  prediction, it is a formality. Aim for a leader under 60%.
- **Every option needs a prior share**, and the shares should roughly sum to
  1. They are renormalised on load, so being slightly off is fine; leaving one
  out is a validation error.

### SPLIT

```ts
{
  id: 'dessert-coffee',
  question: 'What % of players would rather give up {a} for a year than {b} for a year?',
  subjectA: 'dessert',
  subjectB: 'coffee',
  priorPercent: 62,
  priorWeight: 400,
}
```

`{a}` and `{b}` are substituted at render time. Keep both subjects concrete
and comparable — the question should be a real trade-off, not a preference
between two unrelated things.

## Setting a prior

The prior is a guess with a stated confidence, expressed in pseudo-responses:

- **300** — a genuine guess. Real data overtakes it within a few hundred
  players.
- **400–500** — a question with a well-known answer (people pick 7; people
  pick blue). Worth defending against the first few hundred contrarians.
- **Above 1,000** — almost never. That is a prior that keeps mattering after
  ten thousand people have answered, which means the scoring is measuring the
  author rather than the crowd.

A prior that is badly wrong is self-correcting but not free: the first few
hundred players of that day are scored against it. When in doubt, use 300.

Priors can be adjusted per-day from the admin console (`Prior` on a CROWD
event), which changes that manifest's stored config without touching the
source content.

## Writing rules for all content

- **Never imply the score measures intelligence, ability or health.** No "IQ",
  no "cognitive", no "brain age", no "your brain is X years old".
- **Nothing that requires a specific country's culture** to answer. The same
  five events go to everyone.
- **No sensitive subjects as a prediction game.** Politics, religion, health,
  anything about identity.
- **Read it out loud on a phone.** If the question does not fit in two lines
  at 26px, it is too long for a 75-second run.

## Before it goes live

`validateManifest` runs every family's `validateConfig` — a CROWD question
with a missing prior or an ORDER set whose solution references an unknown item
fails there rather than in front of players. The admin console previews the
next thirty days, and a day can be regenerated or have a family swapped until
it is frozen.
