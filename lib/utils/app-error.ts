import { AppError, ErrorCode } from '../errors';
import { NONE_EXIST_ERROR } from './error';

type UnknownRecord = Record<string, any>;

function isRecord(v: unknown): v is UnknownRecord {
  return Boolean(v) && typeof v === 'object';
}

function messageFromUnknown(err: unknown): string {
  if (typeof err === 'string') return err;
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

function unwrapCauses(err: unknown, maxDepth = 5): unknown[] {
  const chain: unknown[] = [];
  let cur: unknown = err;
  for (let i = 0; i < maxDepth; i++) {
    chain.push(cur);
    if (!isRecord(cur) || !('cause' in cur)) break;
    cur = (cur as any).cause;
    if (!cur) break;
  }
  return chain;
}

function statusFromUnknown(err: unknown): number | undefined {
  if (!isRecord(err)) return undefined;
  const status = (err as any).status;
  return typeof status === 'number' && Number.isFinite(status) ? status : undefined;
}

function codeFromUnknown(err: unknown): string | undefined {
  if (!isRecord(err)) return undefined;
  const code = (err as any).code || (err as any).errno;
  return typeof code === 'string' ? code : undefined;
}

function nameFromUnknown(err: unknown): string | undefined {
  if (!isRecord(err)) return undefined;
  const name = (err as any).name;
  return typeof name === 'string' ? name : undefined;
}

function proxyUsedFromUnknown(err: unknown): boolean | undefined {
  if (!isRecord(err)) return undefined;
  const snake = (err as any).proxy_used;
  if (typeof snake === 'boolean') return snake;
  const camel = (err as any).proxyUsed;
  if (typeof camel === 'boolean') return camel;
  return undefined;
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const chain = unwrapCauses(err);
  const message = messageFromUnknown(err);
  const normalized = message.toLowerCase();

  const names = chain.map(nameFromUnknown).filter(Boolean) as string[];
  const codes = chain.map(codeFromUnknown).filter(Boolean) as string[];
  const statuses = chain.map(statusFromUnknown).filter((s): s is number => typeof s === 'number');
  const status = statuses[0];
  const proxy_used = chain.map(proxyUsedFromUnknown).find((v) => typeof v === 'boolean');
  // Only return non-sensitive context. The HTTP layer may echo `details` to clients.
  const details = typeof proxy_used === 'boolean' ? { proxy_used } : undefined;

  // Invalid/unsupported inputs should be treated as client errors.
  if (
    normalized.includes('scraper not found:') ||
    normalized.includes('normalizer not found:') ||
    normalized.includes('formatter not found:') ||
    normalized.includes('unsupported url') ||
    // Keep these patterns narrow to avoid misclassifying parser errors like "JSON-LD script not found".
    /^missing\b/i.test(message) ||
    /^invalid\b/i.test(message) ||
    normalized.includes('missing query parameter') ||
    normalized.includes("invalid '") ||
    normalized.includes("missing '")
  ) {
    return new AppError(ErrorCode.INVALID_PARAM, message, details);
  }

  // Site-specific "not found" message used across this repo.
  // Avoid broad substring matching ("not found") because many parser errors include it
  // (e.g. "JSON-LD script not found") and should be treated as INTERNAL_ERROR.
  if (message === NONE_EXIST_ERROR) {
    return new AppError(ErrorCode.TARGET_NOT_FOUND, message, details);
  }

  // HTTP status hints from custom errors.
  if (status === 404) return new AppError(ErrorCode.TARGET_NOT_FOUND, message, details);
  if (status === 403 || status === 429)
    return new AppError(ErrorCode.TARGET_BLOCKING, message, details);

  // Timeout / abort.
  if (
    names.some((n) => n === 'AbortError') ||
    codes.some((c) => c === 'ETIMEDOUT' || c === 'ECONNRESET' || c === 'UND_ERR_CONNECT_TIMEOUT') ||
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('abort')
  ) {
    return new AppError(ErrorCode.TARGET_TIMEOUT, message, details);
  }

  // Anti-bot / captcha / WAF challenges.
  if (
    normalized.includes('sec.douban.com') ||
    normalized.includes('anti-bot') ||
    normalized.includes('captcha') ||
    normalized.includes('cloudflare') ||
    normalized.includes('waf')
  ) {
    return new AppError(ErrorCode.TARGET_BLOCKING, message, details);
  }

  return new AppError(ErrorCode.INTERNAL_ERROR, message, details);
}
