import { createApp } from '../app';
import { CloudflareKVStorage } from '../storage/cloudflare';
import { MemoryStorage } from '../storage/memory';
import { createRuntimeSetup } from './env';

export async function createCloudflareRuntime(env: Record<string, unknown>) {
  const setup = createRuntimeSetup({ platform: 'cloudflare', env, bindings: env });

  try {
    const storage =
      setup.storageProvider === 'cloudflare-kv' && env.PT_GEN_STORE
        ? new CloudflareKVStorage(env.PT_GEN_STORE)
        : new MemoryStorage();
    return createApp(storage, setup.appConfig);
  } catch (error) {
    console.warn('[ptgen] Failed to initialize Cloudflare storage, falling back to memory.', error);
    return createApp(new MemoryStorage(), { ...setup.appConfig, storageProvider: 'memory' });
  }
}
