import { createApp } from '../app';
import { EdgeOneKVStorage } from '../storage/edgeone';
import { MemoryStorage } from '../storage/memory';
import { createRuntimeSetup } from './env';

export async function createEdgeOneRuntime(env: Record<string, unknown>) {
  const setup = createRuntimeSetup({ platform: 'edgeone', env, bindings: env });

  try {
    const storage =
      setup.storageProvider === 'edgeone-kv' && env.PT_GEN_STORE
        ? new EdgeOneKVStorage(env.PT_GEN_STORE)
        : new MemoryStorage();
    return createApp(storage, setup.appConfig);
  } catch (error) {
    console.warn('[ptgen] Failed to initialize EdgeOne storage, falling back to memory.', error);
    return createApp(new MemoryStorage(), { ...setup.appConfig, storageProvider: 'memory' });
  }
}
