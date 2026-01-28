import { Hono, Context } from 'hono'
import { cors } from 'hono/cors'
import { AppConfig } from '../lib/types/config';
import { Orchestrator } from '../lib/orchestrator';
import { V1Controller } from './controllers/v1';
import { V2Controller } from './controllers/v2';
import { AppError, ErrorCode } from '../lib/errors';
import { DEFAULT_SITE_PLUGINS } from './registry';

export interface Storage {
  get(key: string): Promise<string | null>
  put(key: string, value: string, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
}

// Cache key hashing: KV has key length limits; hashing also normalizes long/variable queries.
async function sha256Hex(input: string): Promise<string> {
  // Prefer WebCrypto (CF Workers / modern runtimes).
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(input)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // Very old runtimes fallback: FNV-1a 32-bit (non-cryptographic).
  // This should effectively never be used in supported targets, but avoids bundling Node built-ins.
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // 32-bit FNV-1a prime multiplication
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function stableSearchString(url: URL): string {
  // Make query order stable for better cache hit ratio.
  const entries = Array.from(url.searchParams.entries())
    .filter(([k]) => k !== 'apikey' && k !== 'debug')
    .sort(([ak, av], [bk, bv]) => (ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)))
  if (entries.length === 0) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of entries) sp.append(k, v)
  return `?${sp.toString()}`
}

/**
 * 创建 Hono 应用
 * @param {Storage} storage - 存储实现（KV 或 Memory）
 * @param {Object} config - 配置对象
 */
export function createApp(storage: Storage, config: AppConfig = {}) {
  const app = new Hono()

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
          request_id: c.req.header('x-request-id')
        }
      }, err.httpStatus as any);
    }

    const message =
      typeof err === 'string'
        ? err
        : (err &&
            typeof err === 'object' &&
            'message' in err &&
            typeof (err as any).message === 'string')
          ? (err as any).message
          : 'Internal Server Error'

    return c.json({
      error: {
        code: 'INTERNAL_ERROR',
        message
      }
    }, 500);
  });

  // 初始化 Orchestrator 和 Controllers
  const orchestrator = new Orchestrator(config, DEFAULT_SITE_PLUGINS);
  const v1 = new V1Controller(orchestrator, config);
  const v2 = new V2Controller(orchestrator, config);

  // HTML must be provided by the runtime adapter (Node/Bun/CF).
  const htmlPage = config.htmlPage || ''
  const cacheTTL = normalizeCacheTTL(config.cacheTTL) // 默认 2 天

  // 全局 CORS 中间件
  app.use('*', cors())

  function normalizeCacheTTL(value: unknown): number {
    const DEFAULT = 86400 * 2
    if (value === undefined) return DEFAULT
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return DEFAULT
    // TTL is seconds; enforce integer semantics.
    return Math.floor(value)
  }

  function getRequestApiKey(c: Context): string | undefined {
    const q = c.req.query('apikey')
    if (q) return q

    const headerKey = c.req.header('x-api-key') || c.req.header('apikey')
    if (headerKey) return headerKey

    const auth = c.req.header('authorization')
    if (!auth) return undefined
    const m = auth.match(/^Bearer\s+(.+)$/i)
    return m?.[1]
  }

  // 生成缓存键
  async function generateCacheKey(c: Context) {
    const url = new URL(c.req.url)
    const stableSearch = stableSearchString(url)
    const rawKey = `${c.req.method}:${url.pathname}${stableSearch}`
    const hashed = await sha256Hex(rawKey)
    return `ptgen:cache:${hashed}`
  }

  // APIKEY 验证中间件
  app.use('/api/*', async (c, next) => {
    if (config.apikey && getRequestApiKey(c) !== config.apikey) {
      const pathname = new URL(c.req.url).pathname
      // V1 keeps legacy-ish error shape; V2 uses unified AppError schema.
      if (pathname.startsWith('/api/v2/')) {
        throw new AppError(ErrorCode.AUTH_FAILED, 'apikey required.')
      }
      return c.json({ error: 'apikey required.' }, 403)
    }
    await next()
  })

  // 缓存中间件
  app.use('/api/*', async (c, next) => {
    if (cacheTTL === 0) return next()
    // Only cache GET. POST (e.g. /api/v2/info JSON body) must never share cache keys.
    if (c.req.method !== 'GET') return next()
    // Debug responses should never be cached, and should never be served from cache.
    // `debug` is intentionally excluded from the cache key for hit ratio, so we must bypass.
    if (c.req.query('debug') === '1') return next()

    let cacheKey: string | null = null
    try {
      cacheKey = await generateCacheKey(c)
    } catch {
      // If key generation fails for any reason, just bypass cache.
      return next()
    }

    try {
      const cached = await storage.get(cacheKey)
      if (cached) {
        try {
          return c.json(JSON.parse(cached))
        } catch {
          // Corrupted cache entry: best-effort delete.
          try { await storage.delete(cacheKey) } catch { }
        }
      }
    } catch {
      // Cache backend errors must not affect the main response.
    }

    await next()

    if (c.res.status === 200) {
      try {
        const clonedRes = c.res.clone()
        const data = await clonedRes.json()
        // 如果数据中没有 error 字段，或者 success 为 true，则缓存
        // 适配 V1 和 V2 的成功判断逻辑
        const isV1Success = data.success === true;
        const isV2Success = data.meta && !data.error; // V2 success usually has meta and no error

        if (isV1Success || isV2Success || (!data.error && !data.success)) {
          const write = storage.put(cacheKey, JSON.stringify(data), cacheTTL)
          // In CF Workers, avoid delaying the response on cache writes when possible.
          const execCtx = (c as any).executionCtx
          if (execCtx && typeof execCtx.waitUntil === 'function') {
            execCtx.waitUntil(write)
          } else {
            await write
          }
        }
      } catch {
        // Never let cache serialization/write failures break the response.
      }
    }
  })

  // ==================== Root & Redirects ====================

  app.get('/', async (c) => {
    const search = c.req.query('search')
    const url = c.req.query('url')
    const site = c.req.query('site')

    if (!search && !url && !site) {
      if (htmlPage) return c.html(htmlPage)
      return c.text('PT-Gen')
    }

    // 兼容旧 Query Params -> 重定向到 API V1
    if (search) {
      const source = c.req.query('source') || 'douban'
      const apikey = c.req.query('apikey')
      const apikeyParam = apikey ? `&apikey=${apikey}` : ''
      return c.redirect(
        `/api/v1/search?q=${encodeURIComponent(search)}&source=${encodeURIComponent(source)}${apikeyParam}`
      )
    }
    if (url) {
      const apikey = c.req.query('apikey')
      const apikeyParam = apikey ? `&apikey=${apikey}` : ''
      return c.redirect(`/api/v1/info?url=${encodeURIComponent(url)}${apikeyParam}`)
    }
    if (site) {
      const sid = c.req.query('sid')
      const apikey = c.req.query('apikey')
      if (!sid) {
        return c.json({ error: 'Missing sid' }, 400)
      }
      const apikeyParam = apikey ? `?apikey=${apikey}` : ''
      return c.redirect(
        `/api/v1/info/${encodeURIComponent(site)}/${encodeURIComponent(sid)}${apikeyParam}`
      )
    }
  })

  // ==================== API V1 Endpoints ====================

  app.get('/api/v1/search', (c) => v1.handleSearch(c))
  app.get('/api/v1/info', (c) => v1.handleInfo(c))
  app.get('/api/v1/info/:site/:sid', (c) => v1.handleInfo(c))

  // ==================== API V2 Endpoints ====================

  app.get('/api/v2/search', (c) => v2.handleSearch(c))

  // V2 Info - GET (Query & Path) & POST (JSON)
  app.get('/api/v2/info', (c) => v2.handleInfo(c))
  app.post('/api/v2/info', (c) => v2.handleInfo(c))
  app.get('/api/v2/info/:site/:sid', (c) => v2.handleInfo(c))
  // I should probably support RESTful path in V2 as well if desired, but spec was just query.
  // I'll stick to query param as primary V2 for now based on plan.

  // ==================== Aliases (Legacy) ====================

  app.get('/api/search', async (c) => {
    const queryString = new URLSearchParams(c.req.query()).toString()
    return c.redirect(`/api/v1/search?${queryString}`)
  })

  app.get('/api/info', async (c) => {
    const queryString = new URLSearchParams(c.req.query()).toString()
    return c.redirect(`/api/v1/info?${queryString}`)
  })

  app.get('/api/info/:site/:sid', async (c) => {
    const site = c.req.param('site')
    const sid = c.req.param('sid')
    const queryString = new URLSearchParams(c.req.query()).toString()
    const query = queryString ? `?${queryString}` : ''
    return c.redirect(`/api/v1/info/${site}/${sid}${query}`)
  })

  return app
}
