import { describe, it, expect } from 'vitest';
import { ensureArray } from '../../lib/utils/array';
import { normalizeMaybeArray, normalizeCookie } from '../../lib/utils/string';
import { extractSortableDateKey } from '../../lib/utils/date';

describe('Utils', () => {
    describe('array', () => {
        it('ensureArray should wrap value in array', () => {
            expect(ensureArray('a')).toEqual(['a']);
            expect(ensureArray(['a'])).toEqual(['a']);
            expect(ensureArray(null)).toEqual([]);
        });
    });

    describe('string', () => {
        it('normalizeMaybeArray should join array', () => {
            expect(normalizeMaybeArray(['a', 'b'])).toBe('a/b');
            expect(normalizeMaybeArray('a')).toBe('a');
            expect(normalizeMaybeArray(null)).toBe('');
        });

        it('normalizeCookie should clean cookie string', () => {
            expect(normalizeCookie('a=b; c=d;; ')).toBe('a=b; c=d');
        });
    });

    describe('date', () => {
        it('extractSortableDateKey should extract date', () => {
            expect(extractSortableDateKey('2022-01-01(US)')).toBe('2022-01-01');
            expect(extractSortableDateKey('no date')).toBe('');
        });
    });
});
