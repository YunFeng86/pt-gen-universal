import { AppError, ErrorCode } from '../errors';
import { NONE_EXIST_ERROR } from './error';

function messageFromUnknown(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return (err as any).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const message = messageFromUnknown(err);
  const normalized = message.toLowerCase();

  // Invalid/unsupported inputs should be treated as client errors.
  if (
    normalized.includes('scraper not found:') ||
    normalized.includes('normalizer not found:') ||
    normalized.includes('formatter not found:') ||
    normalized.includes('unsupported url') ||
    normalized.includes('invalid') ||
    normalized.includes('missing ')
  ) {
    return new AppError(ErrorCode.INVALID_PARAM, message);
  }

  // Site-specific "not found" message used across this repo.
  // Avoid broad substring matching ("not found") because many parser errors include it
  // (e.g. "JSON-LD script not found") and should be treated as INTERNAL_ERROR.
  if (message === NONE_EXIST_ERROR) {
    return new AppError(ErrorCode.TARGET_NOT_FOUND, message);
  }

  // Timeout / abort.
  if (normalized.includes('timeout') || normalized.includes('abort')) {
    return new AppError(ErrorCode.TARGET_TIMEOUT, message);
  }

  // Anti-bot / captcha / WAF challenges.
  if (
    normalized.includes('sec.douban.com') ||
    normalized.includes('anti-bot') ||
    normalized.includes('captcha') ||
    normalized.includes('cloudflare') ||
    normalized.includes('waf')
  ) {
    return new AppError(ErrorCode.TARGET_BLOCKING, message);
  }

  return new AppError(ErrorCode.INTERNAL_ERROR, message);
}
