import { MemoryStorage } from '../storage/memory';
import { RedisStorage } from '../storage/redis';
import { VercelRedisStorage } from '../storage/vercel-redis';
import type { Storage } from '../storage/storage';
import { parseNumberEnv } from '../utils/env';
import { type RuntimePlatform } from './env';
import { createRuntimeApp } from './runtime-factory';

export interface NodeRuntimeResult {
  app: Awaited<ReturnType<typeof createRuntimeApp>>['app'];
  port: number;
}

function createMemoryStorage(values: Record<string, string | undefined>) {
  return new MemoryStorage({
    maxEntries: parseNumberEnv(values.CACHE_MAX_ENTRIES),
    sweepIntervalMs: parseNumberEnv(values.CACHE_SWEEP_INTERVAL_MS),
  });
}

async function resolveNodeStorage(
  platform: RuntimePlatform,
  values: Record<string, string | undefined>,
  storageProvider: string
): Promise<Storage> {
  try {
    switch (storageProvider) {
      case 'redis':
        if (!values.REDIS_URL) throw new Error('REDIS_URL is required for redis storage');
        return await RedisStorage.fromUrl(values.REDIS_URL);
      case 'vercel-redis':
        return await VercelRedisStorage.fromEnv(values);
      case 'memory':
        return createMemoryStorage(values);
      default:
        return createMemoryStorage(values);
    }
  } catch (error) {
    console.warn(
      `[ptgen] Failed to initialize ${storageProvider} storage for ${platform}, falling back to memory.`,
      error
    );
    return createMemoryStorage(values);
  }
}

export async function createNodeRuntime(
  platform: Extract<RuntimePlatform, 'node' | 'bun'>,
  env: Record<string, unknown>
): Promise<NodeRuntimeResult> {
  const { app, setup } = await createRuntimeApp({
    platform,
    env,
    createStorage: async (runtimeSetup) =>
      await resolveNodeStorage(platform, runtimeSetup.values, runtimeSetup.storageProvider),
    createFallbackStorage: (runtimeSetup) => createMemoryStorage(runtimeSetup.values),
    fallbackMessage: `[ptgen] Failed to initialize runtime storage for ${platform}, falling back to memory.`,
  });

  return {
    app,
    port: setup.port,
  };
}
