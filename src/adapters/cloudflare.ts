import { createApp } from '../app'
import { CloudflareKVStorage } from '../storage/cloudflare'
import page from '../../index.html'

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
        disableSearch: env.DISABLE_SEARCH === 'true',
        cacheTTL: env.CACHE_TTL ? Number(env.CACHE_TTL) : undefined,
        htmlPage: page,
        tmdbApiKey: env.TMDB_API_KEY,
        doubanCookie: env.DOUBAN_COOKIE,
        indienovaCookie: env.INDIENOVA_COOKIE
      })
    }

    return cachedApp.fetch(request, env, ctx)
  }
}
