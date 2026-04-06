import type { AppConfig, RateLimitMode, StorageProvider } from '../../lib/types/config';
import { parseBooleanEnv, parseNumberEnv } from '../utils/env';
import { createHomePage } from './page';

export type RuntimePlatform = 'node' | 'bun' | 'cloudflare' | 'vercel' | 'netlify' | 'edgeone';

export interface RuntimeContext {
  platform: RuntimePlatform;
  env: Record<string, unknown>;
  bindings?: Record<string, unknown>;
}

export interface NormalizedRuntimeSetup {
  appConfig: AppConfig;
  port: number;
  storeName: string;
  storageProvider: StorageProvider;
  values: Record<string, string | undefined>;
}

export function normalizeEnvValues(env: Record<string, unknown>): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === null) {
      values[key] = undefined;
      continue;
    }

    if (typeof value === 'string') {
      values[key] = value;
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      values[key] = String(value);
    }
  }

  return values;
}

function hasKVBinding(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof (value as any).get === 'function' &&
      typeof (value as any).put === 'function' &&
      typeof (value as any).delete === 'function'
  );
}

export function parseStorageProvider(value: unknown): StorageProvider | undefined {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return undefined;

  if (
    raw === 'auto' ||
    raw === 'memory' ||
    raw === 'cloudflare-kv' ||
    raw === 'vercel-redis' ||
    raw === 'netlify-blobs' ||
    raw === 'edgeone-kv' ||
    raw === 'redis'
  ) {
    return raw;
  }

  return undefined;
}

export function parseRateLimitMode(value: unknown): RateLimitMode | undefined {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'off' || raw === 'best-effort') return raw;
  return undefined;
}

function hasVercelRedisEnv(values: Record<string, string | undefined>): boolean {
  return Boolean(
    (values.KV_REST_API_URL && values.KV_REST_API_TOKEN) ||
      (values.UPSTASH_REDIS_REST_URL && values.UPSTASH_REDIS_REST_TOKEN)
  );
}

export function resolveStorageProvider(
  platform: RuntimePlatform,
  requested: StorageProvider,
  values: Record<string, string | undefined>,
  bindings?: Record<string, unknown>
): StorageProvider {
  if (requested !== 'auto') return requested;

  switch (platform) {
    case 'cloudflare':
      return hasKVBinding(bindings?.PT_GEN_STORE) ? 'cloudflare-kv' : 'memory';
    case 'edgeone':
      return hasKVBinding(bindings?.PT_GEN_STORE) ? 'edgeone-kv' : 'memory';
    case 'vercel':
      return hasVercelRedisEnv(values) ? 'vercel-redis' : 'memory';
    case 'netlify':
      return 'netlify-blobs';
    case 'node':
    case 'bun':
      return values.REDIS_URL ? 'redis' : hasVercelRedisEnv(values) ? 'vercel-redis' : 'memory';
    default:
      return 'memory';
  }
}

export function createRuntimeSetup(context: RuntimeContext): NormalizedRuntimeSetup {
  const values = normalizeEnvValues(context.env);
  const requestedStorageProvider = parseStorageProvider(values.STORAGE_PROVIDER) || 'auto';
  const storageProvider = resolveStorageProvider(
    context.platform,
    requestedStorageProvider,
    values,
    context.bindings
  );
  const rateLimitMode = parseRateLimitMode(values.RATE_LIMIT_MODE) || 'off';
  const rateLimitPerMinute =
    rateLimitMode === 'best-effort' ? parseNumberEnv(values.RATE_LIMIT_PER_MINUTE) ?? 0 : 0;

  const appConfig: AppConfig = {
    apikey: values.APIKEY,
    disableSearch: parseBooleanEnv(values.DISABLE_SEARCH) ?? false,
    enableDebug: parseBooleanEnv(values.ENABLE_DEBUG) ?? false,
    cacheTTL: parseNumberEnv(values.CACHE_TTL),
    htmlPage: createHomePage(context.platform, storageProvider),
    proxyUrl: values.PROXY_URL,
    proxyAllowSensitiveHeaders: parseBooleanEnv(values.PROXY_ALLOW_SENSITIVE_HEADERS) ?? false,
    tmdbApiKey: values.TMDB_API_KEY,
    doubanCookie: values.DOUBAN_COOKIE,
    indienovaCookie: values.INDIENOVA_COOKIE,
    doubanUserAgent: values.DOUBAN_USER_AGENT,
    doubanAcceptLanguage: values.DOUBAN_ACCEPT_LANGUAGE,
    doubanTimeoutMs: parseNumberEnv(values.DOUBAN_TIMEOUT_MS),
    doubanWarmupTimeoutMs: parseNumberEnv(values.DOUBAN_WARMUP_TIMEOUT_MS),
    imdbUserAgent: values.IMDB_USER_AGENT,
    imdbTimeoutMs: parseNumberEnv(values.IMDB_TIMEOUT_MS),
    tmdbTimeoutMs: parseNumberEnv(values.TMDB_TIMEOUT_MS),
    tmdbUserAgent: values.TMDB_USER_AGENT,
    timeout: parseNumberEnv(values.REQUEST_TIMEOUT_MS),
    rateLimitMode,
    rateLimitPerMinute,
    storageProvider,
  };

  return {
    appConfig,
    port: parseNumberEnv(values.PORT) ?? 3000,
    storeName: values.CACHE_STORE_NAME || 'pt-gen-cache',
    storageProvider,
    values,
  };
}
