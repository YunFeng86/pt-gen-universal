import { createApp } from '../app'
import { CloudflareKVStorage } from '../storage/cloudflare'
import page from '../../index.html'
import { parseBooleanEnv, parseNumberEnv } from '../utils/env'

/**
 * Cloudflare Workers 入口
 */

// 缓存应用实例（只初始化一次）
let cachedApp: any = null

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
        proxyUrl: env.PROXY_URL,
        proxyAllowSensitiveHeaders:
          parseBooleanEnv(env.PROXY_ALLOW_SENSITIVE_HEADERS) ?? false,
        tmdbApiKey: env.TMDB_API_KEY,
        doubanCookie: env.DOUBAN_COOKIE,
        indienovaCookie: env.INDIENOVA_COOKIE
      })
    }

    return cachedApp.fetch(request, env, ctx)
  }
}
