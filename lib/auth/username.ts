/**
 * Username rules. Applied on the server before anything is written, and
 * reused by the client so the field can refuse bad input as it is typed.
 */

const RESERVED = new Set([
  'admin', 'human', 'root', 'support', 'system', 'help', 'api', 'official',
  'moderator', 'mod', 'staff', 'null', 'undefined', 'me', 'you',
]);

/** Deliberately narrow: letters, digits, underscore. No spoofable lookalikes. */
const PATTERN = /^[a-z0-9_]{3,16}$/;

/**
 * Control characters, zero-width characters and bidi overrides. A display
 * name containing these can reorder or hide the text around it, which is a
 * problem in a product whose whole surface is leaderboard rows.
 */
const INVISIBLE = /[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export interface NameCheck {
  ok: boolean;
  value: string;
  error?: string;
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, '');
}

export function checkUsername(input: string): NameCheck {
  const value = normalizeUsername(input);
  if (value.length < 3) return { ok: false, value, error: 'Too short - 3 characters minimum.' };
  if (value.length > 16) return { ok: false, value, error: 'Too long - 16 characters maximum.' };
  if (!PATTERN.test(value)) {
    return { ok: false, value, error: 'Letters, numbers and underscores only.' };
  }
  if (RESERVED.has(value)) return { ok: false, value, error: 'That one is reserved.' };
  return { ok: true, value };
}

export function sanitizeDisplayName(input: string): string {
  return input.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

export function checkDisplayName(input: string): NameCheck {
  const value = sanitizeDisplayName(input);
  if (value.length < 1) return { ok: false, value, error: 'Give yourself a name.' };
  return { ok: true, value };
}

export function checkCrewName(input: string): NameCheck {
  const value = sanitizeDisplayName(input);
  if (value.length < 2) return { ok: false, value, error: 'Crew names need 2 characters.' };
  if (crewSlug(value).length < 2) {
    return { ok: false, value, error: 'Use at least two letters or numbers.' };
  }
  return { ok: true, value };
}

/** URL-safe form of a crew name. */
export function crewSlug(name: string): string {
  return sanitizeDisplayName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

/** Six-character invite code, unambiguous characters only. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(random: () => number = Math.random): string {
  let out = '';
  for (let index = 0; index < 6; index += 1) {
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return out;
}
