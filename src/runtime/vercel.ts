import { MemoryStorage } from '../storage/memory';
import { VercelRedisStorage } from '../storage/vercel-redis';
import { createRuntimeApp } from './runtime-factory';

export async function createVercelRuntime(env: Record<string, unknown>) {
  const { app } = await createRuntimeApp({
    platform: 'vercel',
    env,
    createStorage: async (setup) =>
      setup.storageProvider === 'vercel-redis'
        ? await VercelRedisStorage.fromEnv(setup.values)
        : new MemoryStorage(),
    fallbackMessage: '[ptgen] Failed to initialize Vercel storage, falling back to memory.',
  });

  return app;
}
