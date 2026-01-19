import { serve } from '@hono/node-server'
import { createApp } from '../app'
import { MemoryStorage } from '../storage/memory'

/**
 * Node.js 运行时入口
 */

// 创建内存存储适配器
const storage = new MemoryStorage()

// 创建 Hono 应用
const app = createApp(storage, {
  apikey: process.env.APIKEY,
  disableSearch: process.env.DISABLE_SEARCH === 'true',
  cacheTTL: process.env.CACHE_TTL ? Number(process.env.CACHE_TTL) : undefined,
  tmdbApiKey: process.env.TMDB_API_KEY,
  doubanCookie: process.env.DOUBAN_COOKIE,
  indienovaCookie: process.env.INDIENOVA_COOKIE
})

// Node.js 服务器配置
const port = Number(process.env.PORT) || 3000

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`🚀 PT-Gen server running on http://localhost:${info.port}`)
})
