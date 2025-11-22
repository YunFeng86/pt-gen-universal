import { createApp } from '../app.js'
import { CloudflareKVStorage } from '../storage/cloudflare.js'
import page from '../../index.html'

/**
 * Cloudflare Workers 入口
 */
export default {
  async fetch(request, env, ctx) {
    // 创建 KV 存储适配器
    const storage = new CloudflareKVStorage(env.PT_GEN_STORE)

    // 创建 Hono 应用
    const app = createApp(storage, {
      apikey: env.APIKEY,
      disableSearch: env.DISABLE_SEARCH === 'true',
      cacheTTL: env.CACHE_TTL ? Number(env.CACHE_TTL) : undefined,
      htmlPage: page
    })

    // 处理请求
    return app.fetch(request, env, ctx)
  }
}
