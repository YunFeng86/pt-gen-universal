import { createApp } from '../app'
import { CloudflareKVStorage } from '../storage/cloudflare'
import page from '../../index.html'

/**
 * Cloudflare Workers 入口
 */

// 缓存应用实例（只初始化一次）
let cachedApp: any = null

function parseBooleanEnv(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined
  const s = String(value).trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true
  if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false
  return undefined
}

function parseNumberEnv(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (!cachedApp) {
      const storage = new CloudflareKVStorage(env.PT_GEN_STORE)
      cachedApp = createApp(storage, {
        apikey: env.APIKEY,
        disableSearch: parseBooleanEnv(env.DISABLE_SEARCH) ?? false,
        enableDebug: parseBooleanEnv(env.ENABLE_DEBUG) ?? false,
        cacheTTL: parseNumberEnv(env.CACHE_TTL),
        htmlPage: page,
        tmdbApiKey: env.TMDB_API_KEY,
        doubanCookie: env.DOUBAN_COOKIE,
        indienovaCookie: env.INDIENOVA_COOKIE
      })
    }

    return cachedApp.fetch(request, env, ctx)
  }
}
