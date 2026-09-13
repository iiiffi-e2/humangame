import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PracticeReplay } from '@/features/practice/PracticeReplay';

describe('PracticeReplay landing', () => {
  it('renders the replay prompt and does not start on first paint', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const html = renderToString(<PracticeReplay reducedMotion={false} />);

    expect(html).toContain('Practice');
    expect(html).toContain('This run does not count.');
    expect(html).toMatch(/Play today.+s five again/);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
