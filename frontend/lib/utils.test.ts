import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins class values', () => {
    expect(cn('flex', 'items-center', 'gap-2')).toBe('flex items-center gap-2');
  });

  it('ignores falsy inputs (conditional classes)', () => {
    expect(cn('flex', false && 'hidden', null, undefined)).toBe('flex');
  });

  it('merges conflicting Tailwind classes, last one wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm', 'font-bold', 'text-lg')).toBe('font-bold text-lg');
  });

  it('handles arrays and objects from clsx', () => {
    expect(cn(['flex', 'row'], { hidden: false, 'p-4': true })).toBe(
      'flex row p-4'
    );
  });

  it('returns an empty string without inputs', () => {
    expect(cn()).toBe('');
  });
});
