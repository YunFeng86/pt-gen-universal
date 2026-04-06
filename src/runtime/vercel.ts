import { createApp } from '../app';
import { MemoryStorage } from '../storage/memory';
import { VercelRedisStorage } from '../storage/vercel-redis';
import { createRuntimeSetup } from './env';

export async function createVercelRuntime(env: Record<string, unknown>) {
  const setup = createRuntimeSetup({ platform: 'vercel', env });

  try {
    const storage =
      setup.storageProvider === 'vercel-redis'
        ? await VercelRedisStorage.fromEnv(setup.values)
        : new MemoryStorage();
    return createApp(storage, setup.appConfig);
  } catch (error) {
    console.warn('[ptgen] Failed to initialize Vercel storage, falling back to memory.', error);
    return createApp(new MemoryStorage(), { ...setup.appConfig, storageProvider: 'memory' });
  }
}
