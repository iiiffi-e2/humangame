import { describe, expect, it } from 'vitest';
import { notificationAudience, shouldNotify } from '@/lib/notify/policy';

describe('shouldNotify', () => {
  it('never notifies when the preference is off', () => {
    expect(shouldNotify('off', 'rival')).toBe(false);
    expect(shouldNotify('off', 'social')).toBe(false);
  });

  it('limits rivals-only to rival events', () => {
    expect(shouldNotify('rivals', 'rival')).toBe(true);
    expect(shouldNotify('rivals', 'social')).toBe(false);
  });

  it('sends everything when the preference is all', () => {
    expect(shouldNotify('all', 'rival')).toBe(true);
    expect(shouldNotify('all', 'social')).toBe(true);
  });
});

describe('notificationAudience', () => {
  it('classifies kinds', () => {
    expect(notificationAudience('rival_finished')).toBe('rival');
    expect(notificationAudience('rival_beat_you')).toBe('rival');
    expect(notificationAudience('rivalry_accepted')).toBe('rival');
    expect(notificationAudience('crew_joined')).toBe('social');
  });
});
