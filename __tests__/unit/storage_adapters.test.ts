import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudflareKVStorage } from '../../src/storage/cloudflare';
import { EdgeOneKVStorage } from '../../src/storage/edgeone';
import { NetlifyBlobsStorage } from '../../src/storage/netlify-blobs';
import { RedisStorage } from '../../src/storage/redis';
import { VercelRedisStorage } from '../../src/storage/vercel-redis';

class FakeKVNamespace {
  public readonly map = new Map<string, string>();
  public lastOptions: Record<string, unknown> | undefined;

  async get(key: string) {
    return this.map.get(key) ?? null;
  }

  async put(key: string, value: string, options?: Record<string, unknown>) {
    this.map.set(key, value);
    this.lastOptions = options;
  }

  async delete(key: string) {
    this.map.delete(key);
  }
}

class FakeTextStore {
  public readonly map = new Map<string, string>();

  async get(key: string, options?: Record<string, unknown>) {
    const value = this.map.get(key);
    if (!value) return null;
    if (options?.type === 'json') return JSON.parse(value);
    return value;
  }

  async set(key: string, value: string) {
    this.map.set(key, value);
  }

  async delete(key: string) {
    this.map.delete(key);
  }
}

class FakeRedisClient {
  public readonly map = new Map<string, string>();
  public lastSetOptions: Record<string, unknown> | undefined;

  async get(key: string) {
    return this.map.get(key) ?? null;
  }

  async set(key: string, value: string, options?: Record<string, unknown>) {
    this.map.set(key, value);
    this.lastSetOptions = options;
  }

  async del(key: string) {
    this.map.delete(key);
  }
}

describe('storage adapters', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('Cloudflare KV adapter forwards ttl and CRUD calls', async () => {
    const kv = new FakeKVNamespace();
    const storage = new CloudflareKVStorage(kv);

    await storage.put('foo', 'bar', 120);
    expect(await storage.get('foo')).toBe('bar');
    expect(kv.lastOptions).toEqual({ expirationTtl: 120 });

    await storage.delete('foo');
    expect(await storage.get('foo')).toBeNull();
  });

  it('EdgeOne KV adapter behaves like a KV wrapper', async () => {
    const kv = new FakeKVNamespace();
    const storage = new EdgeOneKVStorage(kv);

    await storage.put('foo', 'bar');
    expect(await storage.get('foo')).toBe('bar');

    await storage.delete('foo');
    expect(await storage.get('foo')).toBeNull();
  });

  it('Vercel Redis adapter stores strings with EX ttl', async () => {
    const client = new FakeRedisClient();
    const storage = new VercelRedisStorage(client as any);

    await storage.put('foo', 'bar', 60);
    expect(await storage.get('foo')).toBe('bar');
    expect(client.lastSetOptions).toEqual({ ex: 60 });

    await storage.delete('foo');
    expect(await storage.get('foo')).toBeNull();
  });

  it('Redis adapter stores strings with EX ttl', async () => {
    const client = new FakeRedisClient();
    const storage = new RedisStorage(client as any);

    await storage.put('foo', 'bar', 30);
    expect(await storage.get('foo')).toBe('bar');
    expect(client.lastSetOptions).toEqual({ EX: 30 });

    await storage.delete('foo');
    expect(await storage.get('foo')).toBeNull();
  });

  it('Netlify Blobs adapter keeps ttl using an envelope', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const store = new FakeTextStore();
    const storage = new NetlifyBlobsStorage(store as any);

    await storage.put('foo', 'bar', 1);
    expect(await storage.get('foo')).toBe('bar');

    vi.advanceTimersByTime(1100);
    expect(await storage.get('foo')).toBeNull();
    expect(store.map.size).toBe(0);
  });
});
