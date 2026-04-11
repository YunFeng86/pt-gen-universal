import { CloudflareKVStorage } from '../storage/cloudflare';
import { MemoryStorage } from '../storage/memory';
import { createRuntimeApp } from './runtime-factory';

export async function createCloudflareRuntime(env: Record<string, unknown>) {
  const { app } = await createRuntimeApp({
    platform: 'cloudflare',
    env,
    bindings: env,
    createStorage: (setup) =>
      setup.storageProvider === 'cloudflare-kv' && env.PT_GEN_STORE
        ? new CloudflareKVStorage(env.PT_GEN_STORE)
        : new MemoryStorage(),
    fallbackMessage: '[ptgen] Failed to initialize Cloudflare storage, falling back to memory.',
  });

  return app;
}
