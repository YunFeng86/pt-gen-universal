import { createApp } from '../app'
import { MemoryStorage } from '../storage/memory'

/**
 * Bun 运行时入口
 */

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

// 创建内存存储适配器
const storage = new MemoryStorage()

// 创建 Hono 应用
const app = createApp(storage, {
  apikey: process.env.APIKEY,
  disableSearch: parseBooleanEnv(process.env.DISABLE_SEARCH) ?? false,
  enableDebug: parseBooleanEnv(process.env.ENABLE_DEBUG) ?? false,
  cacheTTL: parseNumberEnv(process.env.CACHE_TTL),
  tmdbApiKey: process.env.TMDB_API_KEY,
  doubanCookie: process.env.DOUBAN_COOKIE,
  indienovaCookie: process.env.INDIENOVA_COOKIE
})

// Bun 服务器配置
export default {
  fetch: app.fetch,
  port: Number(process.env.PORT) || 3000
}

console.log(`🚀 PT-Gen server running on http://localhost:${Number(process.env.PORT) || 3000}`)
