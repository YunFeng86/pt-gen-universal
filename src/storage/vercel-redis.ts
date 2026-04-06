import type { Storage } from './storage';

interface VercelRedisClientLike {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, options?: Record<string, unknown>): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export class VercelRedisStorage implements Storage {
  constructor(private readonly redis: VercelRedisClientLike) {}

  static async fromEnv(values: Record<string, string | undefined>): Promise<VercelRedisStorage> {
    const url = values.KV_REST_API_URL || values.UPSTASH_REDIS_REST_URL;
    const token = values.KV_REST_API_TOKEN || values.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error('Upstash/Vercel KV REST credentials are required');
    }

    const { Redis } = await import('@upstash/redis');
    return new VercelRedisStorage(new Redis({ url, token }) as VercelRedisClientLike);
  }

  async get(key: string): Promise<string | null> {
    const value = await this.redis.get(key);
    if (value === undefined || value === null) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  async put(key: string, value: string, ttl?: number): Promise<void> {
    const options = ttl ? { ex: ttl } : undefined;
    await this.redis.set(key, value, options);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
