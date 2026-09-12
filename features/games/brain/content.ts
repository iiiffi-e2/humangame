/**
 * Authored content for BRAIN / ORDER. Every set is five items with an
 * unambiguous numeric ordering and a unit the player can reason about
 * without specialist knowledge. See `docs/content-authoring.md`.
 */
export interface OrderSet {
  id: string;
  prompt: string;
  hint: string;
  items: Array<{ id: string; label: string; value: number }>;
}

export const ORDER_SETS: readonly OrderSet[] = [
  {
    id: 'population',
    prompt: 'Smallest → largest.',
    hint: 'By population.',
    items: [
      { id: 'iceland', label: 'Iceland', value: 0.39 },
      { id: 'portugal', label: 'Portugal', value: 10.4 },
      { id: 'tokyo', label: 'Tokyo metro', value: 37.2 },
      { id: 'canada', label: 'Canada', value: 40.1 },
      { id: 'nigeria', label: 'Nigeria', value: 223.8 },
    ],
  },
  {
    id: 'distance',
    prompt: 'Closest → furthest.',
    hint: 'Distance from the Sun.',
    items: [
      { id: 'mercury', label: 'Mercury', value: 58 },
      { id: 'earth', label: 'Earth', value: 150 },
      { id: 'mars', label: 'Mars', value: 228 },
      { id: 'jupiter', label: 'Jupiter', value: 778 },
      { id: 'neptune', label: 'Neptune', value: 4495 },
    ],
  },
  {
    id: 'height',
    prompt: 'Shortest → tallest.',
    hint: 'Structure height.',
    items: [
      { id: 'bigben', label: 'Big Ben', value: 96 },
      { id: 'pyramid', label: 'Great Pyramid', value: 139 },
      { id: 'eiffel', label: 'Eiffel Tower', value: 330 },
      { id: 'empire', label: 'Empire State', value: 443 },
      { id: 'burj', label: 'Burj Khalifa', value: 828 },
    ],
  },
  {
    id: 'speed',
    prompt: 'Slowest → fastest.',
    hint: 'Top speed.',
    items: [
      { id: 'human', label: 'Sprinter', value: 44 },
      { id: 'greyhound', label: 'Greyhound', value: 72 },
      { id: 'cheetah', label: 'Cheetah', value: 114 },
      { id: 'train', label: 'Bullet train', value: 320 },
      { id: 'falcon', label: 'Diving falcon', value: 389 },
    ],
  },
  {
    id: 'invented',
    prompt: 'Oldest → newest.',
    hint: 'Year it appeared.',
    items: [
      { id: 'press', label: 'Printing press', value: 1440 },
      { id: 'bulb', label: 'Light bulb', value: 1879 },
      { id: 'tv', label: 'Television', value: 1927 },
      { id: 'web', label: 'World Wide Web', value: 1989 },
      { id: 'phone', label: 'Touch smartphone', value: 2007 },
    ],
  },
  {
    id: 'depth',
    prompt: 'Shallowest → deepest.',
    hint: 'Average depth.',
    items: [
      { id: 'baltic', label: 'Baltic Sea', value: 55 },
      { id: 'yellow', label: 'Yellow Sea', value: 44 },
      { id: 'north', label: 'North Sea', value: 95 },
      { id: 'med', label: 'Mediterranean', value: 1500 },
      { id: 'pacific', label: 'Pacific Ocean', value: 4280 },
    ],
  },
  {
    id: 'boiling',
    prompt: 'Coldest → hottest.',
    hint: 'Boiling point at sea level.',
    items: [
      { id: 'nitrogen', label: 'Nitrogen', value: -196 },
      { id: 'ethanol', label: 'Ethanol', value: 78 },
      { id: 'water', label: 'Water', value: 100 },
      { id: 'mercuryel', label: 'Mercury', value: 357 },
      { id: 'iron', label: 'Iron', value: 2862 },
    ],
  },
  {
    id: 'runtime',
    prompt: 'Shortest → longest.',
    hint: 'How long one lasts.',
    items: [
      { id: 'song', label: 'A pop single', value: 3 },
      { id: 'sitcom', label: 'A sitcom episode', value: 22 },
      { id: 'football', label: 'A football match', value: 90 },
      { id: 'flightny', label: 'London → New York', value: 480 },
      { id: 'marathonwatch', label: 'A trilogy marathon', value: 540 },
    ],
  },
];
