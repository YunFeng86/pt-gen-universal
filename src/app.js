import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { AUTHOR, VERSION } from '../lib/common.js'
import debug_get_err from '../lib/error.js'

import { search_douban, gen_douban } from '../lib/douban.js'
import { search_imdb, gen_imdb } from '../lib/imdb.js'
import { search_bangumi, gen_bangumi } from '../lib/bangumi.js'
import { gen_steam } from '../lib/steam.js'
import { gen_indienova } from '../lib/indienova.js'
import { gen_gog } from '../lib/gog.js'
import { search_tmdb, gen_tmdb } from '../lib/tmdb.js'

// 读取 HTML 页面（兼容 Node.js 和 CF Workers）
let page = ''

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
      console.warn('Failed to load HTML page:', e.message)
    }
  }
  // CF Workers 环境下，page 会在 createApp 时通过参数传入
}

// 立即加载 HTML（仅在 Node.js/Bun 环境）
await loadHtmlPage()

// 站点 URL 匹配规则
const support_list = {
  "douban": /(?:https?:\/\/)?(?:(?:movie|www|m)\.)?douban\.com\/(?:(?:movie\/)?subject|movie)\/(\d+)\/?/,
  "imdb": /(?:https?:\/\/)?(?:www\.)?imdb\.com\/title\/(tt\d+)\/?/,
  "bangumi": /(?:https?:\/\/)?(?:bgm\.tv|bangumi\.tv|chii\.in)\/subject\/(\d+)\/?/,
  "steam": /(?:https?:\/\/)?(?:store\.)?steam(?:powered|community)\.com\/app\/(\d+)\/?/,
  "indienova": /(?:https?:\/\/)?indienova\.com\/(?:game|g)\/(\S+)/,
  "gog": /(?:https?:\/\/)?(?:www\.)?gog\.com\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?game\/([\w-]+)/,
  "tmdb": /(?:https?:\/\/)?(?:www\.)?themoviedb\.org\/(?:(movie|tv))\/(\d+)\/?/
}

/**
 * 创建 Hono 应用
 * @param {Storage} storage - 存储实现（KV 或 Memory）
 * @param {Object} config - 配置对象
 * @param {string} config.apikey - API 密钥（可选）
 * @param {boolean} config.disableSearch - 是否禁用搜索功能
 * @param {string} config.htmlPage - HTML 页面内容（CF Workers 环境需要传入）
 * @param {number} config.cacheTTL - 缓存过期时间（秒），默认 172800（2天）
 * @param {string} config.tmdbApiKey - TMDB API 密钥（可选）
 * @param {string} config.doubanCookie - 豆瓣 Cookie（可选）
 * @param {number} config.doubanTimeoutMs - 豆瓣请求超时（毫秒，可选，默认 10000）
 * @param {number} config.doubanWarmupTimeoutMs - 豆瓣 warmup 请求超时（毫秒，可选）
 * @param {string} config.doubanUserAgent - 豆瓣请求 UA（可选）
 * @param {string} config.doubanAcceptLanguage - 豆瓣请求语言（可选）
 * @param {boolean} config.doubanIncludeAwards - 是否抓取获奖信息（可选，默认 true）
 * @param {boolean} config.doubanIncludeImdb - 是否抓取 IMDb 评分（可选，默认 true）
 * @param {string} config.indienovaCookie - Indienova Cookie（可选）
 */
export function createApp(storage, config = {}) {
  const app = new Hono()

  // 搜索处理器映射表
  const searchHandlers = new Map([
    ['douban', search_douban],
    ['imdb', search_imdb],
    ['bangumi', search_bangumi],
    ['tmdb', search_tmdb]
  ])

  // 信息生成处理器映射表
  const genHandlers = new Map([
    ['douban', gen_douban],
    ['imdb', gen_imdb],
    ['bangumi', gen_bangumi],
    ['steam', gen_steam],
    ['indienova', gen_indienova],
    ['gog', gen_gog],
    ['tmdb', gen_tmdb]
  ])

  // 使用传入的 HTML 页面或默认的 page 变量
  const htmlPage = config.htmlPage || page
  const cacheTTL = config.cacheTTL !== undefined ? config.cacheTTL : 86400 * 2 // 默认 2 天

  // 全局 CORS 中间件
  app.use('*', cors())

  // 根路径：返回 HTML 页面或处理旧 API 兼容
  app.get('/', async (c) => {
    const search = c.req.query('search')
    const url = c.req.query('url')
    const site = c.req.query('site')

    // 如果没有任何查询参数，返回 HTML 页面
    if (!search && !url && !site) {
      return c.html(htmlPage)
    }

    // 旧 API 兼容：重定向到 v1 API
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
      const apikeyParam = apikey ? `?apikey=${apikey}` : ''
      return c.redirect(`/api/v1/info/${site}/${sid}${apikeyParam}`)
    }
  })

  // APIKEY 验证中间件（应用于所有 API 路由）
  app.use('/api/*', async (c, next) => {
    if (config.apikey && c.req.query('apikey') !== config.apikey) {
      return c.json({ error: 'apikey required.' }, 403)
    }
    await next()
  })

  // 生成缓存键（剔除认证参数，提高缓存共享率）
  function generateCacheKey(c) {
    const url = new URL(c.req.url)
    // 移除认证相关参数
    url.searchParams.delete('apikey')
    url.searchParams.delete('debug')
    // 使用规范化后的 URL 作为缓存键
    return url.pathname + url.search
  }

  // 缓存中间件（应用于所有 API 路由）
  app.use('/api/*', async (c, next) => {
    // 如果 cacheTTL 为 0，跳过缓存
    if (cacheTTL === 0) {
      return next()
    }

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

    // 缓存响应（只缓存成功的响应）
    if (c.res.status === 200) {
      const clonedRes = c.res.clone()
      const data = await clonedRes.json()
      if (!data.error) {
        await storage.put(cacheKey, JSON.stringify(data), cacheTTL)
      }
    }
  })

  // ==================== API v1 路由 ====================

  // v1: 搜索路由
  app.get('/api/v1/search', async (c) => {
    if (config.disableSearch) {
      return c.json({ error: 'this ptgen disallow search' }, 403)
    }

    const keywords = c.req.query('q') || c.req.query('search')
    const source = c.req.query('source') || 'douban'

    if (!keywords) {
      return c.json({ error: 'Missing query parameter: q or search' }, 400)
    }

    const handler = searchHandlers.get(source)
    if (!handler) {
      return c.json({ error: `Unknown value of key 'source': ${source}` }, 400)
    }

    try {
      const data = await handler(keywords, config)
      return c.json(makeJsonResponseData(data))
    } catch (e) {
      return handleError(c, e)
    }
  })

  // v1: 信息查询路由（URL 模式）
  app.get('/api/v1/info', async (c) => {
    const url = c.req.query('url')
    if (!url) {
      return c.json({ error: 'Missing url parameter' }, 400)
    }

    // URL 匹配逻辑
    for (const [site, pattern] of Object.entries(support_list)) {
      const match = url.match(pattern)
      if (match) {
        // TMDB 特殊处理：捕获媒体类型和 ID
        const sid = site === 'tmdb'
          ? `${match[1]}-${match[2]}`
          : match[1]

        return handleSiteInfo(c, site, sid)
      }
    }

    return c.json({ error: 'Unsupported URL or input unsupported resource url' }, 400)
  })

  // v1: 信息查询路由（RESTful 模式）
  app.get('/api/v1/info/:site/:sid', async (c) => {
    const site = c.req.param('site')
    const sid = c.req.param('sid')
    return handleSiteInfo(c, site, sid)
  })

  // ==================== API 便捷别名（指向最新稳定版 v1）====================

  // 便捷别名：搜索
  app.get('/api/search', async (c) => {
    const queryString = new URLSearchParams(c.req.query()).toString()
    return c.redirect(`/api/v1/search?${queryString}`)
  })

  // 便捷别名：信息查询（URL 模式）
  app.get('/api/info', async (c) => {
    const queryString = new URLSearchParams(c.req.query()).toString()
    return c.redirect(`/api/v1/info?${queryString}`)
  })

  // 便捷别名：信息查询（RESTful 模式）
  app.get('/api/info/:site/:sid', async (c) => {
    const site = c.req.param('site')
    const sid = c.req.param('sid')
    const queryString = new URLSearchParams(c.req.query()).toString()
    const query = queryString ? `?${queryString}` : ''
    return c.redirect(`/api/v1/info/${site}/${sid}${query}`)
  })

  // 站点信息处理函数（消除重复代码）
  async function handleSiteInfo(c, site, sid) {
    const handler = genHandlers.get(site)
    if (!handler) {
      return c.json({ error: `Unknown value of key 'site': ${site}` }, 400)
    }

    try {
      const data = await handler(sid, config)
      return c.json(makeJsonResponseData(data))
    } catch (e) {
      return handleError(c, e)
    }
  }

  // 错误处理函数
  function handleError(c, e) {
    const debug = c.req.query('debug') === '1'
    const err_return = {
      error: `Internal Error, Please contact @${AUTHOR}. Exception: ${e.message}`
    }

    if (debug) {
      err_return['debug'] = debug_get_err(e, c.req.raw)
    }

    return c.json(makeJsonResponseData(err_return), 500)
  }

  // 生成响应数据（兼容旧格式）
  function makeJsonResponseData(body_update) {
    return {
      success: !body_update.error,
      error: body_update.error || null,
      format: body_update.format || '',
      copyright: `Powered by @${AUTHOR}`,
      version: VERSION,
      generate_at: Date.now(),
      ...body_update
    }
  }

  return app
}
