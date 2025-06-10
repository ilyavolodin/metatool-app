import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('deduplicates and merges conditional classes', () => {
    const result = cn('a', 'b', undefined, 'a', { d: true });
    expect(result).toBe('a b a d');
  });
});
