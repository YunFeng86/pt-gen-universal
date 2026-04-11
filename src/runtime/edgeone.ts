import { EdgeOneKVStorage } from '../storage/edgeone';
import { MemoryStorage } from '../storage/memory';
import { createRuntimeApp } from './runtime-factory';

export async function createEdgeOneRuntime(env: Record<string, unknown>) {
  const { app } = await createRuntimeApp({
    platform: 'edgeone',
    env,
    bindings: env,
    createStorage: (setup) =>
      setup.storageProvider === 'edgeone-kv' && env.PT_GEN_STORE
        ? new EdgeOneKVStorage(env.PT_GEN_STORE)
        : new MemoryStorage(),
    fallbackMessage: '[ptgen] Failed to initialize EdgeOne storage, falling back to memory.',
  });

  return app;
}
