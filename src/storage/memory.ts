/**
 * 内存存储实现（用于 Node.js / Bun）
 */
export class MemoryStorage {
  private store: Map<string, string>;
  private expiries: Map<string, number>;

  constructor() {
    this.store = new Map()
    this.expiries = new Map()
  }

  async get(key: string): Promise<string | null> {
    const expiry = this.expiries.get(key)
    if (expiry && Date.now() > expiry) {
      await this.delete(key)
      return null
    }
    return this.store.get(key) || null
  }

  async put(key: string, value: string, ttl?: number): Promise<void> {
    this.store.set(key, value)
    if (ttl) {
      this.expiries.set(key, Date.now() + ttl * 1000)
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
    this.expiries.delete(key)
  }
}
