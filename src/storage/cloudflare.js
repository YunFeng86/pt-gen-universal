/**
 * Cloudflare KV 存储适配器
 */
export class CloudflareKVStorage {
  /**
   * @param {KVNamespace} kv - CF Workers KV 命名空间
   */
  constructor(kv) {
    this.kv = kv
  }

  async get(key) {
    return await this.kv.get(key)
  }

  async put(key, value, ttl) {
    const options = ttl ? { expirationTtl: ttl } : {}
    await this.kv.put(key, value, options)
  }

  async delete(key) {
    await this.kv.delete(key)
  }
}
