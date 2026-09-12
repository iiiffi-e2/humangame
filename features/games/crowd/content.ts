/**
 * Authored CROWD content. Each question carries a prior — the shares we
 * expect before anyone has answered, plus how strongly we believe it, in
 * pseudo-responses. Priors are editable from the admin page.
 * See `docs/content-authoring.md`.
 */

export interface CrowdOption {
  id: string;
  label: string;
}

export interface MajorityQuestion {
  id: string;
  question: string;
  options: CrowdOption[];
  /** Expected share per option id. */
  priorShares: Record<string, number>;
  priorWeight: number;
}

export interface SplitQuestion {
  id: string;
  /** Rendered with `{a}` and `{b}` already substituted. */
  question: string;
  subjectA: string;
  subjectB: string;
  /** Expected percentage choosing A, 0..100. */
  priorPercent: number;
  priorWeight: number;
}

export const MAJORITY_QUESTIONS: readonly MajorityQuestion[] = [
  {
    id: 'window-aisle',
    question: 'Which seat will most players pick?',
    options: [
      { id: 'window', label: 'Window' },
      { id: 'aisle', label: 'Aisle' },
      { id: 'middle', label: 'Middle' },
    ],
    priorShares: { window: 0.55, aisle: 0.41, middle: 0.04 },
    priorWeight: 400,
  },
  {
    id: 'first-move',
    question: 'What will most players say they do first in the morning?',
    options: [
      { id: 'phone', label: 'Check the phone' },
      { id: 'coffee', label: 'Make coffee' },
      { id: 'shower', label: 'Shower' },
    ],
    priorShares: { phone: 0.52, coffee: 0.31, shower: 0.17 },
    priorWeight: 350,
  },
  {
    id: 'pizza',
    question: 'Which topping will the crowd rally behind?',
    options: [
      { id: 'pepperoni', label: 'Pepperoni' },
      { id: 'mushroom', label: 'Mushroom' },
      { id: 'pineapple', label: 'Pineapple' },
    ],
    priorShares: { pepperoni: 0.58, mushroom: 0.26, pineapple: 0.16 },
    priorWeight: 420,
  },
  {
    id: 'superpower',
    question: 'Which power will most players choose?',
    options: [
      { id: 'fly', label: 'Flight' },
      { id: 'invisible', label: 'Invisibility' },
      { id: 'time', label: 'Stop time' },
    ],
    priorShares: { fly: 0.38, invisible: 0.21, time: 0.41 },
    priorWeight: 300,
  },
  {
    id: 'number',
    question: 'Which number will the crowd pick most?',
    options: [
      { id: 'three', label: '3' },
      { id: 'seven', label: '7' },
      { id: 'nine', label: '9' },
    ],
    priorShares: { three: 0.24, seven: 0.58, nine: 0.18 },
    priorWeight: 500,
  },
  {
    id: 'holiday',
    question: 'Where will most players say they would rather be?',
    options: [
      { id: 'beach', label: 'A beach' },
      { id: 'mountain', label: 'A mountain' },
      { id: 'city', label: 'A city' },
    ],
    priorShares: { beach: 0.47, mountain: 0.3, city: 0.23 },
    priorWeight: 320,
  },
];

export const SPLIT_QUESTIONS: readonly SplitQuestion[] = [
  {
    id: 'dessert-coffee',
    question: 'What % of players would rather give up {a} for a year than {b} for a year?',
    subjectA: 'dessert',
    subjectB: 'coffee',
    priorPercent: 62,
    priorWeight: 400,
  },
  {
    id: 'early-late',
    question: 'What % of players say they are {a} rather than {b}?',
    subjectA: 'a morning person',
    subjectB: 'a night owl',
    priorPercent: 41,
    priorWeight: 350,
  },
  {
    id: 'text-call',
    question: 'What % of players would rather {a} than {b}?',
    subjectA: 'send ten texts',
    subjectB: 'make one phone call',
    priorPercent: 71,
    priorWeight: 380,
  },
  {
    id: 'sweet-savoury',
    question: 'What % of players pick {a} over {b} for breakfast?',
    subjectA: 'savoury',
    subjectB: 'sweet',
    priorPercent: 56,
    priorWeight: 300,
  },
  {
    id: 'spoiler',
    question: 'What % of players would rather {a} than {b}?',
    subjectA: 'know the ending first',
    subjectB: 'be surprised',
    priorPercent: 23,
    priorWeight: 420,
  },
  {
    id: 'lottery',
    question: 'What % of players would rather take {a} than {b}?',
    subjectA: '$1,000 today',
    subjectB: '$1,400 in a year',
    priorPercent: 64,
    priorWeight: 360,
  },
];

/** AVOID uses the same option sets, but the player wants the loneliest answer. */
export const AVOID_QUESTIONS: readonly MajorityQuestion[] = [
  {
    id: 'avoid-door',
    question: 'Pick the door the fewest players will pick.',
    options: [
      { id: 'one', label: 'Door one' },
      { id: 'two', label: 'Door two' },
      { id: 'three', label: 'Door three' },
      { id: 'four', label: 'Door four' },
    ],
    priorShares: { one: 0.31, two: 0.27, three: 0.26, four: 0.16 },
    priorWeight: 300,
  },
  {
    id: 'avoid-colour',
    question: 'Pick the colour the fewest players will pick.',
    options: [
      { id: 'blue', label: 'Blue' },
      { id: 'red', label: 'Red' },
      { id: 'green', label: 'Green' },
      { id: 'yellow', label: 'Yellow' },
    ],
    priorShares: { blue: 0.42, red: 0.24, green: 0.2, yellow: 0.14 },
    priorWeight: 380,
  },
  {
    id: 'avoid-animal',
    question: 'Pick the animal the fewest players will pick.',
    options: [
      { id: 'dog', label: 'Dog' },
      { id: 'cat', label: 'Cat' },
      { id: 'otter', label: 'Otter' },
      { id: 'hawk', label: 'Hawk' },
    ],
    priorShares: { dog: 0.38, cat: 0.31, otter: 0.19, hawk: 0.12 },
    priorWeight: 320,
  },
  {
    id: 'avoid-seat',
    question: 'Pick the row the fewest players will pick.',
    options: [
      { id: 'front', label: 'Front row' },
      { id: 'middle', label: 'Middle' },
      { id: 'back', label: 'Back row' },
      { id: 'balcony', label: 'Balcony' },
    ],
    priorShares: { front: 0.22, middle: 0.41, back: 0.24, balcony: 0.13 },
    priorWeight: 300,
  },
];
