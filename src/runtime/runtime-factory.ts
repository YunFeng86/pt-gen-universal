import { createApp } from '../app';
import { MemoryStorage } from '../storage/memory';
import type { Storage } from '../storage/storage';
import {
  createRuntimeSetup,
  type NormalizedRuntimeSetup,
  type RuntimePlatform,
} from './env';

type StorageFactory = (setup: NormalizedRuntimeSetup) => Storage | Promise<Storage>;

export interface RuntimeFactoryOptions {
  platform: RuntimePlatform;
  env: Record<string, unknown>;
  bindings?: Record<string, unknown>;
  createStorage: StorageFactory;
  createFallbackStorage?: StorageFactory;
  fallbackMessage: string;
}

export interface RuntimeFactoryResult {
  app: ReturnType<typeof createApp>;
  setup: NormalizedRuntimeSetup;
}

function createDefaultFallbackStorage() {
  return new MemoryStorage();
}

export async function createRuntimeApp(
  options: RuntimeFactoryOptions
): Promise<RuntimeFactoryResult> {
  const setup = createRuntimeSetup({
    platform: options.platform,
    env: options.env,
    bindings: options.bindings,
  });

  try {
    const storage = await options.createStorage(setup);
    return {
      app: createApp(storage, setup.appConfig),
      setup,
    };
  } catch (error) {
    console.warn(options.fallbackMessage, error);

    const fallbackStorage = options.createFallbackStorage
      ? await options.createFallbackStorage(setup)
      : createDefaultFallbackStorage();
    const fallbackSetup: NormalizedRuntimeSetup = {
      ...setup,
      storageProvider: 'memory',
      appConfig: {
        ...setup.appConfig,
        storageProvider: 'memory',
      },
    };

    return {
      app: createApp(fallbackStorage, fallbackSetup.appConfig),
      setup: fallbackSetup,
    };
  }
}
