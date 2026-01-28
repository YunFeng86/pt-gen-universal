import { describe, expect, it } from 'vitest';
import { toAppError } from '../../lib/utils/app-error';
import { ErrorCode } from '../../lib/errors';
import { NONE_EXIST_ERROR } from '../../lib/utils/error';

describe('toAppError', () => {
    it('maps AbortError to TARGET_TIMEOUT', () => {
        const err = { name: 'AbortError', message: 'The operation was aborted.' };
        expect(toAppError(err).code).toBe(ErrorCode.TARGET_TIMEOUT);
    });

    it('maps status=404 to TARGET_NOT_FOUND', () => {
        const err = { message: 'Not Found', status: 404 };
        expect(toAppError(err).code).toBe(ErrorCode.TARGET_NOT_FOUND);
    });

    it('maps NONE_EXIST_ERROR to TARGET_NOT_FOUND', () => {
        expect(toAppError(new Error(NONE_EXIST_ERROR)).code).toBe(ErrorCode.TARGET_NOT_FOUND);
    });

    it('does not misclassify parser "not found" as INVALID_PARAM', () => {
        const err = new Error('IMDb page parse failed: JSON-LD script not found');
        expect(toAppError(err).code).toBe(ErrorCode.INTERNAL_ERROR);
    });

    it('maps narrow invalid/missing messages to INVALID_PARAM', () => {
        expect(toAppError(new Error("Invalid 'format' parameter")).code).toBe(
            ErrorCode.INVALID_PARAM
        );
        expect(toAppError(new Error("Missing 'url' parameter")).code).toBe(
            ErrorCode.INVALID_PARAM
        );
    });
});

