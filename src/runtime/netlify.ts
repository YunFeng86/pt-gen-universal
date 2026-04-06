import { createApp } from '../app';
import { MemoryStorage } from '../storage/memory';
import { NetlifyBlobsStorage } from '../storage/netlify-blobs';
import { createRuntimeSetup } from './env';

export async function createNetlifyRuntime(env: Record<string, unknown>) {
  const setup = createRuntimeSetup({ platform: 'netlify', env });

  try {
    const storage =
      setup.storageProvider === 'netlify-blobs'
        ? await NetlifyBlobsStorage.fromStoreName(setup.storeName)
        : new MemoryStorage();
    return createApp(storage, setup.appConfig);
  } catch (error) {
    console.warn('[ptgen] Failed to initialize Netlify storage, falling back to memory.', error);
    return createApp(new MemoryStorage(), { ...setup.appConfig, storageProvider: 'memory' });
  }
}
