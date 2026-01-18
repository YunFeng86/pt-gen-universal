/**
 * 内存存储适配器（用于 Bun/Node.js 本地开发）
 * 增强版：支持 LRU 淘汰和定时清理
 */
export class MemoryStorage {
  constructor(options = {}) {
    this.store = new Map()
    this.accessOrder = new Map() // 记录最后访问时间
    this.maxSize = options.maxSize || 1000 // 最大缓存条目数
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000 // 默认 5 分钟清理一次

    // 启动定时清理器（仅在非 Cloudflare Workers 环境）
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => {
        this.cleanup()
      }, this.cleanupInterval)

      // 避免定时器阻止进程退出（仅 Node.js）
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref()
      }
    }
  }

  async get(key) {
    const item = this.store.get(key)
    if (!item) return null

    // 检查是否过期
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key)
      this.accessOrder.delete(key)
      return null
    }

    // 更新最后访问时间（LRU）
    this.accessOrder.set(key, Date.now())
    return item.value
  }

  async put(key, value, ttl) {
    // 检查容量限制，执行 LRU 淘汰
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this.evictLRU()
    }

    this.store.set(key, {
      value,
      expires: ttl ? Date.now() + ttl * 1000 : undefined
    })
    this.accessOrder.set(key, Date.now())
  }

  async delete(key) {
    this.store.delete(key)
    this.accessOrder.delete(key)
  }

  /**
   * LRU 淘汰：移除最久未访问的条目
   */
  evictLRU() {
    if (this.accessOrder.size === 0) return

    // 找到最旧的访问记录
    let oldestKey = null
    let oldestTime = Infinity

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey)
      this.accessOrder.delete(oldestKey)
    }
  }

  /**
   * 定时清理：移除所有过期条目
   */
  cleanup() {
    const now = Date.now()
    const keysToDelete = []

    for (const [key, item] of this.store.entries()) {
      if (item.expires && now > item.expires) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.store.delete(key)
      this.accessOrder.delete(key)
    }

    if (keysToDelete.length > 0) {
      console.log(`[MemoryStorage] Cleaned up ${keysToDelete.length} expired entries`)
    }
  }

  /**
   * 停止定时清理器（用于优雅关闭）
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
  }
}
