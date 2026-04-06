import type { Storage } from './storage';

interface RedisClientLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: Record<string, unknown>): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export class RedisStorage implements Storage {
  constructor(private readonly redis: RedisClientLike) {}

  static async fromUrl(url: string): Promise<RedisStorage> {
    const { createClient } = await import('redis');
    const client = createClient({ url });
    await client.connect();
    return new RedisStorage(client as RedisClientLike);
  }

  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  async put(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redis.set(key, value, { EX: ttl });
      return;
    }
    await this.redis.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
