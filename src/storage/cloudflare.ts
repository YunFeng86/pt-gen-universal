/**
 * Cloudflare KV 存储适配器
 */
export class CloudflareKVStorage {
  private kv: any;

  constructor(kvNamespace: any) {
    this.kv = kvNamespace
  }

  async get(key: string): Promise<string | null> {
    return await this.kv.get(key)
  }

  async put(key: string, value: string, ttl: number): Promise<void> {
    const options: any = {}
    if (ttl) {
      options.expirationTtl = ttl
    }
    await this.kv.put(key, value, options)
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key)
  }
}
