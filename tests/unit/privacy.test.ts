import { describe, expect, it } from 'vitest';
import { visibleOnNamedBoard } from '@/lib/privacy';

describe('visibleOnNamedBoard', () => {
  it('lets public players appear on every named board', () => {
    expect(visibleOnNamedBoard('public', 'global')).toBe(true);
    expect(visibleOnNamedBoard('public', 'country')).toBe(true);
    expect(visibleOnNamedBoard('public', 'month')).toBe(true);
    expect(visibleOnNamedBoard('public', 'friends')).toBe(true);
    expect(visibleOnNamedBoard('public', 'crews')).toBe(true);
    expect(visibleOnNamedBoard('public', 'rivalry')).toBe(true);
  });

  it('keeps friends-only players off global, country and month boards', () => {
    expect(visibleOnNamedBoard('friends', 'global')).toBe(false);
    expect(visibleOnNamedBoard('friends', 'country')).toBe(false);
    expect(visibleOnNamedBoard('friends', 'month')).toBe(false);
    expect(visibleOnNamedBoard('friends', 'friends')).toBe(true);
    expect(visibleOnNamedBoard('friends', 'crews')).toBe(true);
    expect(visibleOnNamedBoard('friends', 'rivalry')).toBe(true);
  });

  it('omits private players from every named board', () => {
    expect(visibleOnNamedBoard('private', 'global')).toBe(false);
    expect(visibleOnNamedBoard('private', 'friends')).toBe(false);
    expect(visibleOnNamedBoard('private', 'crews')).toBe(false);
    expect(visibleOnNamedBoard('private', 'rivalry')).toBe(false);
  });

  it('always shows the viewer their own row', () => {
    expect(visibleOnNamedBoard('private', 'global', { isViewer: true })).toBe(true);
  });

  it('hides admin-hidden players from public boards', () => {
    expect(visibleOnNamedBoard('public', 'global', { hiddenFromBoards: true })).toBe(false);
    expect(visibleOnNamedBoard('public', 'friends', { hiddenFromBoards: true })).toBe(true);
  });
});
