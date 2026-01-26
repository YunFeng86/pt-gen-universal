import { Hono, Context } from 'hono'
import { cors } from 'hono/cors'
import { AppConfig } from '../lib/types/config';
import { Orchestrator } from '../lib/orchestrator';
import { V1Controller } from './controllers/v1';
import { V2Controller } from './controllers/v2';
import { AppError, ErrorCode } from '../lib/errors';

// 读取 HTML 页面（兼容 Node.js 和 CF Workers）
let page: string = ''

// 检测运行环境并加载 HTML
async function loadHtmlPage() {
  // 检测是否在 Node.js/Bun 环境（有 process 对象）
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const { readFileSync } = await import('fs')
      const { fileURLToPath } = await import('url')
      const { dirname, join } = await import('path')
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      page = readFileSync(join(__dirname, '../index.html'), 'utf-8')
    } catch (e) {
      console.warn('Failed to load HTML page:', (e as any).message)
    }
  }
  // CF Workers 环境下，page 会在 createApp 时通过参数传入
}

// 立即加载 HTML（仅在 Node.js/Bun 环境）
await loadHtmlPage()

/**
 * 创建 Hono 应用
 * @param {Storage} storage - 存储实现（KV 或 Memory）
 * @param {Object} config - 配置对象
 */
export function createApp(storage: any, config: AppConfig = {}) {
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

    return c.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message || 'Internal Server Error'
      }
    }, 500);
  });

  // 初始化 Orchestrator 和 Controllers
  const orchestrator = new Orchestrator(config);
  const v1 = new V1Controller(orchestrator, config);
  const v2 = new V2Controller(orchestrator, config);

  // 使用传入的 HTML 页面或默认的 page 变量
  const htmlPage = config.htmlPage || page
  const cacheTTL = config.cacheTTL !== undefined ? config.cacheTTL : 86400 * 2 // 默认 2 天

  // 全局 CORS 中间件
  app.use('*', cors())

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
  function generateCacheKey(c: Context) {
    const url = new URL(c.req.url)
    url.searchParams.delete('apikey')
    url.searchParams.delete('debug')
    // Include method to avoid collisions (even though we only cache GET today).
    return `${c.req.method}:${url.pathname}${url.search}`
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

    const cacheKey = generateCacheKey(c)
    const cached = await storage.get(cacheKey)

    if (cached) {
      try {
        return c.json(JSON.parse(cached))
      } catch {
        await storage.delete(cacheKey)
      }
    }

    await next()

    if (c.res.status === 200) {
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
    }
  })

  // ==================== Root & Redirects ====================

  app.get('/', async (c) => {
    const search = c.req.query('search')
    const url = c.req.query('url')
    const site = c.req.query('site')

    if (!search && !url && !site) {
      return c.html(htmlPage)
    }

    // 兼容旧 Query Params -> 重定向到 API V1
    if (search) {
      const source = c.req.query('source') || 'douban'
      const apikey = c.req.query('apikey')
      const apikeyParam = apikey ? `&apikey=${apikey}` : ''
      return c.redirect(`/api/v1/search?q=${encodeURIComponent(search)}&source=${source}${apikeyParam}`)
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
      return c.redirect(`/api/v1/info/${site}/${sid}${apikeyParam}`)
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
