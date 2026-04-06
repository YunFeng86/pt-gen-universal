import type { Storage } from './storage';

interface NetlifyBlobStoreLike {
  get(key: string, options?: Record<string, unknown>): Promise<unknown>;
  set(key: string, value: string, options?: Record<string, unknown>): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

type BlobEnvelope = {
  value: string;
  expiresAt: number | null;
};

export class NetlifyBlobsStorage implements Storage {
  constructor(private readonly store: NetlifyBlobStoreLike) {}

  static async fromStoreName(name: string): Promise<NetlifyBlobsStorage> {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name, consistency: 'eventual' }) as NetlifyBlobStoreLike;
    return new NetlifyBlobsStorage(store);
  }

  async get(key: string): Promise<string | null> {
    const entry = (await this.store.get(key, { type: 'json' })) as BlobEnvelope | null;
    if (!entry) return null;

    if (typeof entry === 'string') {
      return entry;
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.delete(key);
      return null;
    }

    return entry.value;
  }

  async put(key: string, value: string, ttl?: number): Promise<void> {
    const envelope: BlobEnvelope = {
      value,
      expiresAt: ttl ? Date.now() + ttl * 1000 : null,
    };
    await this.store.set(key, JSON.stringify(envelope));
  }

  async delete(key: string): Promise<void> {
    await this.store.delete(key);
  }
}
