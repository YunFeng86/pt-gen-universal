import type { Context } from 'hono'
import type { Storage } from '../storage/storage'

// Keep cache rules and key generation in one place so the middleware stays tiny.
export class CacheManager {
  constructor(
    private readonly storage: Storage,
    private readonly cacheTTL: number,
    private readonly prefix = 'ptgen:cache:'
  ) {}

  isEnabled(): boolean {
    return this.cacheTTL !== 0
  }

  isRequestEligible(c: Context): boolean {
    // Only cache GET. POST (e.g. /api/v2/info JSON body) must never share cache keys.
    if (c.req.method !== 'GET') return false
    // Debug responses should never be cached, and should never be served from cache.
    // `debug` is intentionally excluded from the cache key for hit ratio, so we must bypass.
    if (c.req.query('debug') === '1') return false
    return true
  }

  private async sha256Hex(input: string): Promise<string> {
    if (!globalThis.crypto?.subtle) {
      throw new Error('WebCrypto (crypto.subtle) is required for cache key hashing')
    }
    const data = new TextEncoder().encode(input)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private stableSearchString(url: URL): string {
    // Make query order stable for better cache hit ratio.
    const entries = Array.from(url.searchParams.entries())
      .filter(([k]) => k !== 'apikey' && k !== 'debug')
      .sort(([ak, av], [bk, bv]) => (ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)))
    if (entries.length === 0) return ''
    const sp = new URLSearchParams()
    for (const [k, v] of entries) sp.append(k, v)
    return `?${sp.toString()}`
  }

  async makeCacheKey(c: Context): Promise<string> {
    const url = new URL(c.req.url)
    const stableSearch = this.stableSearchString(url)
    const rawKey = `${c.req.method}:${url.pathname}${stableSearch}`
    const hashed = await this.sha256Hex(rawKey)
    return `${this.prefix}${hashed}`
  }

  async get(key: string): Promise<any | null> {
    const cached = await this.storage.get(key)
    if (!cached) return null
    try {
      return JSON.parse(cached)
    } catch {
      // Corrupted cache entry: best-effort delete.
      try {
        await this.storage.delete(key)
      } catch {}
      return null
    }
  }

  async set(key: string, data: unknown): Promise<void> {
    await this.storage.put(key, JSON.stringify(data), this.cacheTTL)
  }
}

