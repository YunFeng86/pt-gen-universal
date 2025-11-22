import { createApp } from '../app.js'
import { MemoryStorage } from '../storage/memory.js'

/**
 * Bun 运行时入口
 */

// 创建内存存储适配器
const storage = new MemoryStorage()

// 创建 Hono 应用
const app = createApp(storage, {
  apikey: process.env.APIKEY,
  disableSearch: process.env.DISABLE_SEARCH === 'true'
})

// Bun 服务器配置
export default {
  fetch: app.fetch,
  port: Number(process.env.PORT) || 3000
}

console.log(`🚀 PT-Gen server running on http://localhost:${Number(process.env.PORT) || 3000}`)
