/**
 * 内存存储适配器（用于 Bun/Node.js 本地开发）
 */
export class MemoryStorage {
  constructor() {
    this.store = new Map()
  }

  async get(key) {
    const item = this.store.get(key)
    if (!item) return null

    // 检查是否过期
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key)
      return null
    }

    return item.value
  }

  async put(key, value, ttl) {
    this.store.set(key, {
      value,
      expires: ttl ? Date.now() + ttl * 1000 : undefined
    })
  }

  async delete(key) {
    this.store.delete(key)
  }
}
