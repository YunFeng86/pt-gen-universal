/**
 * 内存存储实现（用于 Node.js / Bun）
 */
export class MemoryStorage {
  private store: Map<string, string>;
  private expiries: Map<string, number>;
  private maxEntries?: number;
  private sweepIntervalMs: number;
  private lastSweepAt: number;

  constructor(options?: { maxEntries?: number; sweepIntervalMs?: number }) {
    this.store = new Map()
    this.expiries = new Map()
    // Default to a bounded cache to avoid unbounded growth in long-running Node/Bun processes.
    // Set maxEntries <= 0 to disable the limit.
    const rawMax =
      typeof options?.maxEntries === 'number' && Number.isFinite(options.maxEntries)
        ? options.maxEntries
        : 5000
    this.maxEntries = rawMax > 0 ? Math.floor(rawMax) : undefined
    this.sweepIntervalMs =
      typeof options?.sweepIntervalMs === 'number' &&
      Number.isFinite(options.sweepIntervalMs) &&
      options.sweepIntervalMs > 0
        ? Math.floor(options.sweepIntervalMs)
        : 30_000
    this.lastSweepAt = 0
  }

  private sweepExpired(now = Date.now()) {
    // Best-effort opportunistic sweep to avoid unbounded growth from expired keys.
    for (const [key, expiry] of this.expiries.entries()) {
      if (expiry && now > expiry) {
        this.store.delete(key)
        this.expiries.delete(key)
      }
    }
  }

  private maybeSweep() {
    const now = Date.now()
    if (now - this.lastSweepAt < this.sweepIntervalMs) return
    this.lastSweepAt = now
    this.sweepExpired(now)
  }

  private evictIfNeeded() {
    if (!this.maxEntries) return
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value as string | undefined
      if (!oldestKey) return
      this.store.delete(oldestKey)
      this.expiries.delete(oldestKey)
    }
  }

  async get(key: string): Promise<string | null> {
    this.maybeSweep()
    const expiry = this.expiries.get(key)
    if (expiry && Date.now() > expiry) {
      await this.delete(key)
      return null
    }

    const value = this.store.get(key)
    if (value === undefined) return null

    // LRU-ish: touch key to keep hot entries longer when maxEntries is set.
    if (this.maxEntries) {
      this.store.delete(key)
      this.store.set(key, value)
      const exp = this.expiries.get(key)
      if (exp) {
        this.expiries.delete(key)
        this.expiries.set(key, exp)
      }
    }

    return value
  }

  async put(key: string, value: string, ttl?: number): Promise<void> {
    this.maybeSweep()
    this.store.set(key, value)
    if (ttl) {
      this.expiries.set(key, Date.now() + ttl * 1000)
    }
    this.evictIfNeeded()
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
    this.expiries.delete(key)
  }
}
