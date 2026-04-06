import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRuntimeSetup } from '../../src/runtime/env';
import { resolveNetlifyEnv } from '../../netlify/edge-functions/app';

function createKVBinding() {
  return {
    async get() {
      return null;
    },
    async put() {},
    async delete() {},
  };
}

describe('runtime env resolution', () => {
  it('auto-detects Cloudflare KV bindings', () => {
    const env = { APIKEY: 'secret', PT_GEN_STORE: createKVBinding() };
    const setup = createRuntimeSetup({
      platform: 'cloudflare',
      env,
      bindings: env,
    });

    expect(setup.storageProvider).toBe('cloudflare-kv');
    expect(setup.appConfig.storageProvider).toBe('cloudflare-kv');
  });

  it('auto-detects Vercel Redis from REST env vars', () => {
    const setup = createRuntimeSetup({
      platform: 'vercel',
      env: {
        UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token',
      },
    });

    expect(setup.storageProvider).toBe('vercel-redis');
  });

  it('defaults Netlify to blobs storage', () => {
    const setup = createRuntimeSetup({
      platform: 'netlify',
      env: {},
    });

    expect(setup.storageProvider).toBe('netlify-blobs');
    expect(setup.storeName).toBe('pt-gen-cache');
  });

  it('expands Netlify Edge env accessors before building runtime config', () => {
    const env = resolveNetlifyEnv({
      Netlify: {
        env: {
          toObject: () => ({
            APIKEY: 'secret',
            CACHE_STORE_NAME: 'edge-cache',
            RATE_LIMIT_MODE: 'best-effort',
            RATE_LIMIT_PER_MINUTE: '60',
            TMDB_API_KEY: 'tmdb-key',
          }),
        },
      },
    } as unknown as typeof globalThis);
    const setup = createRuntimeSetup({
      platform: 'netlify',
      env,
    });

    expect(setup.appConfig.apikey).toBe('secret');
    expect(setup.appConfig.tmdbApiKey).toBe('tmdb-key');
    expect(setup.appConfig.rateLimitMode).toBe('best-effort');
    expect(setup.appConfig.rateLimitPerMinute).toBe(60);
    expect(setup.storeName).toBe('edge-cache');
  });

  it('prefers explicit STORAGE_PROVIDER over auto detection', () => {
    const env = {
      STORAGE_PROVIDER: 'memory',
      REDIS_URL: 'redis://127.0.0.1:6379',
    };

    const setup = createRuntimeSetup({
      platform: 'node',
      env,
    });

    expect(setup.storageProvider).toBe('memory');
  });

  it('keeps rate limiting off by default and enables it only in best-effort mode', () => {
    const disabled = createRuntimeSetup({
      platform: 'node',
      env: {
        RATE_LIMIT_PER_MINUTE: '60',
      },
    });
    expect(disabled.appConfig.rateLimitMode).toBe('off');
    expect(disabled.appConfig.rateLimitPerMinute).toBe(0);

    const enabled = createRuntimeSetup({
      platform: 'node',
      env: {
        RATE_LIMIT_MODE: 'best-effort',
        RATE_LIMIT_PER_MINUTE: '60',
      },
    });
    expect(enabled.appConfig.rateLimitMode).toBe('best-effort');
    expect(enabled.appConfig.rateLimitPerMinute).toBe(60);
  });

  it('keeps /api-prefixed requests out of the Vercel catch-all rewrite', () => {
    const vercelConfig = JSON.parse(
      readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')
    ) as {
      rewrites: Array<{ source: string; destination: string }>;
    };

    expect(vercelConfig.rewrites).toEqual([
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
      {
        source: '/:path*',
        destination: '/api/:path*',
      },
    ]);
  });
});
