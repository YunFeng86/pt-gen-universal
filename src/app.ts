import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { AppConfig } from '../lib/types/config';
import { Orchestrator } from '../lib/orchestrator';
import { V1Controller } from './controllers/v1';
import { V2Controller } from './controllers/v2';
import { AppError, ErrorCode } from '../lib/errors';
import { DEFAULT_SITE_PLUGINS } from './registry';
import { CTX_CACHEABLE } from './utils/context';
import { CacheManager } from './cache/cache-manager';
import { createRateLimitMiddleware } from './middleware/rate-limit';
import type { Storage } from './storage/storage';

export type { Storage } from './storage/storage';

function normalizeCacheTTL(value: unknown): number {
  const DEFAULT = 86400 * 2;
  if (value === undefined) return DEFAULT;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return DEFAULT;
  // TTL is seconds; enforce integer semantics.
  return Math.floor(value);
}

function getRequestApiKey(c: Context): string | undefined {
  const q = c.req.query('apikey');
  if (q) return q;

  const headerKey = c.req.header('x-api-key') || c.req.header('apikey');
  if (headerKey) return headerKey;

  const auth = c.req.header('authorization');
  if (!auth) return undefined;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1];
}

function createErrorHandler() {
  return (err: unknown, c: Context) => {
    if (err instanceof AppError) {
      const details = err.details;
      const proxy_used =
        typeof (details as any)?.proxy_used === 'boolean' ? (details as any).proxy_used : false;
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details,
            proxy_used,
            request_id: c.req.header('x-request-id'),
          },
        },
        err.httpStatus as any
      );
    }

    const message =
      typeof err === 'string'
        ? err
        : err &&
            typeof err === 'object' &&
            'message' in err &&
            typeof (err as any).message === 'string'
          ? (err as any).message
          : 'Internal Server Error';

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message,
          proxy_used: false,
        },
      },
      500
    );
  };
}

function warnProxyConfig(config: AppConfig) {
  const proxyUrl = String(config.proxyUrl || '').trim();
  if (!proxyUrl) return;

  if (config.proxyAllowSensitiveHeaders) {
    console.warn(
      '[ptgen] PROXY_ALLOW_SENSITIVE_HEADERS is enabled. Cookie/Authorization may be forwarded to the proxy. Use only a trusted/self-hosted proxy.'
    );
  }

  // These cookies are sensitive; by default we intentionally do NOT proxy them.
  const hasSensitiveCookie = Boolean(config.doubanCookie || config.indienovaCookie);
  if (hasSensitiveCookie && !config.proxyAllowSensitiveHeaders) {
    console.warn(
      '[ptgen] PROXY_URL is set but PROXY_ALLOW_SENSITIVE_HEADERS is disabled. DOUBAN_COOKIE/INDIENOVA_COOKIE (if set) will NOT be forwarded to the proxy.'
    );
  }
}

function createAuthMiddleware(config: AppConfig) {
  return async (c: Context, next: () => Promise<void>) => {
    if (config.apikey && getRequestApiKey(c) !== config.apikey) {
      const pathname = new URL(c.req.url).pathname;
      // V1 keeps legacy-ish error shape; V2 uses unified AppError schema.
      if (pathname.startsWith('/api/v2/')) {
        throw new AppError(ErrorCode.AUTH_FAILED, 'apikey required.');
      }
      return c.json({ error: 'apikey required.' }, 403);
    }
    await next();
  };
}

export function createCacheMiddleware(storage: Storage, cacheTTL: number) {
  const cache = new CacheManager(storage, cacheTTL);
  return async (c: Context, next: () => Promise<void>) => {
    if (!cache.isEnabled() || !cache.isRequestEligible(c)) return next();

    let cacheKey: string | null = null;
    try {
      cacheKey = await cache.makeCacheKey(c);
    } catch {
      // If key generation fails for any reason, just bypass cache.
      return next();
    }

    try {
      const cached = await cache.get(cacheKey);
      if (cached) return c.json(cached);
    } catch {
      // Cache backend errors must not affect the main response.
    }

    await next();

    if (c.res.status !== 200) return;
    if (c.get(CTX_CACHEABLE) !== true) return;
    try {
      const clonedRes = c.res.clone();
      const data = await clonedRes.json();
      // 首版默认同步写入，避免不同平台对后台任务生命周期的差异导致缓存写入丢失。
      await cache.set(cacheKey, data);
    } catch {
      // Never let cache serialization/write failures break the response.
    }
  };
}

function setupRoutes(app: Hono, v1: V1Controller, v2: V2Controller, htmlPage: string) {
  // ==================== Root & Redirects ====================

  app.get('/', async (c) => {
    const search = c.req.query('search');
    const url = c.req.query('url');
    const site = c.req.query('site');

    if (!search && !url && !site) {
      if (htmlPage) return c.html(htmlPage);
      return c.text('PT-Gen');
    }

    // 兼容旧 Query Params -> 重定向到 API V1
    if (search) {
      const source = c.req.query('source') || 'douban';
      const apikey = c.req.query('apikey');
      const apikeyParam = apikey ? `&apikey=${apikey}` : '';
      return c.redirect(
        `/api/v1/search?q=${encodeURIComponent(search)}&source=${encodeURIComponent(source)}${apikeyParam}`
      );
    }
    if (url) {
      const apikey = c.req.query('apikey');
      const apikeyParam = apikey ? `&apikey=${apikey}` : '';
      return c.redirect(`/api/v1/info?url=${encodeURIComponent(url)}${apikeyParam}`);
    }
    if (site) {
      const sid = c.req.query('sid');
      const apikey = c.req.query('apikey');
      if (!sid) {
        return c.json({ error: 'Missing sid' }, 400);
      }
      const apikeyParam = apikey ? `?apikey=${apikey}` : '';
      return c.redirect(
        `/api/v1/info/${encodeURIComponent(site)}/${encodeURIComponent(sid)}${apikeyParam}`
      );
    }
  });

  // ==================== API V1 Endpoints ====================

  app.get('/api/v1/search', (c) => v1.handleSearch(c));
  app.get('/api/v1/info', (c) => v1.handleInfo(c));
  app.get('/api/v1/info/:site/:sid', (c) => v1.handleInfo(c));

  // ==================== API V2 Endpoints ====================

  app.get('/api/v2/search', (c) => v2.handleSearch(c));

  // V2 Info - GET (Query & Path) & POST (JSON)
  app.get('/api/v2/info', (c) => v2.handleInfo(c));
  app.post('/api/v2/info', (c) => v2.handleInfo(c));
  app.get('/api/v2/info/:site/:sid', (c) => v2.handleInfo(c));
  // Allow POST with RESTful path too, so body/query can still provide `format` while path provides site/sid.
  app.post('/api/v2/info/:site/:sid', (c) => v2.handleInfo(c));
  // Query is still the primary V2 interface; path params exist for convenience/compat.

  // ==================== Aliases (Legacy) ====================

  app.get('/api/search', async (c) => {
    const queryString = new URLSearchParams(c.req.query()).toString();
    return c.redirect(`/api/v1/search?${queryString}`);
  });

  app.get('/api/info', async (c) => {
    const queryString = new URLSearchParams(c.req.query()).toString();
    return c.redirect(`/api/v1/info?${queryString}`);
  });

  app.get('/api/info/:site/:sid', async (c) => {
    const site = c.req.param('site');
    const sid = c.req.param('sid');
    const queryString = new URLSearchParams(c.req.query()).toString();
    const query = queryString ? `?${queryString}` : '';
    return c.redirect(`/api/v1/info/${site}/${sid}${query}`);
  });
}

/**
 * 创建 Hono 应用
 * @param {Storage} storage - 存储实现（KV 或 Memory）
 * @param {Object} config - 配置对象
 */
export function createApp(storage: Storage, config: AppConfig = {}) {
  const app = new Hono();

  app.onError(createErrorHandler());

  // 初始化 Orchestrator 和 Controllers
  const orchestrator = new Orchestrator(config, DEFAULT_SITE_PLUGINS);
  const v1 = new V1Controller(orchestrator, config);
  const v2 = new V2Controller(orchestrator, config);

  // HTML must be provided by the runtime adapter (Node/Bun/CF).
  const htmlPage = config.htmlPage || '';
  const cacheTTL = normalizeCacheTTL(config.cacheTTL); // 默认 2 天

  warnProxyConfig(config);

  // 全局 CORS 中间件
  app.use('*', cors());

  // Rate Limiting（仅在 best-effort 模式且阈值大于 0 时启用）
  const rateLimit = config.rateLimitPerMinute ?? 0;
  const rateLimitMode = config.rateLimitMode ?? 'off';
  if (rateLimitMode === 'best-effort' && rateLimit > 0) {
    app.use('/api/*', createRateLimitMiddleware(storage, rateLimit));
  }

  app.use('/api/*', createAuthMiddleware(config));
  app.use('/api/*', createCacheMiddleware(storage, cacheTTL));
  setupRoutes(app, v1, v2, htmlPage);

  return app;
}
