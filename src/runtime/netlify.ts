import { MemoryStorage } from '../storage/memory';
import { NetlifyBlobsStorage } from '../storage/netlify-blobs';
import { createRuntimeApp } from './runtime-factory';

export async function createNetlifyRuntime(env: Record<string, unknown>) {
  const { app } = await createRuntimeApp({
    platform: 'netlify',
    env,
    createStorage: async (setup) =>
      setup.storageProvider === 'netlify-blobs'
        ? await NetlifyBlobsStorage.fromStoreName(setup.storeName)
        : new MemoryStorage(),
    fallbackMessage: '[ptgen] Failed to initialize Netlify storage, falling back to memory.',
  });

  return app;
}
