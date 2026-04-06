import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../../lib/types/config';
import { createApp } from '../../src/app';
import { MemoryStorage } from '../../src/storage/memory';
import { createHomePage } from '../../src/runtime/page';

function createAuthApp(overrides: AppConfig = {}) {
  return createApp(new MemoryStorage(), {
    apikey: 'secret',
    cacheTTL: 0,
    htmlPage: createHomePage('node', 'memory'),
    ...overrides,
  });
}

describe('app routes and auth smoke', () => {
  it('serves the runtime homepage on GET /', async () => {
    const app = createAuthApp();
    const res = await app.request('http://localhost/');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('PT-Gen Universal');
  });

  it('redirects legacy /?url= requests to v1 info', async () => {
    const app = createAuthApp();
    const res = await app.request('http://localhost/?url=https://movie.douban.com/subject/1292052/', {
      redirect: 'manual',
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      '/api/v1/info?url=https%3A%2F%2Fmovie.douban.com%2Fsubject%2F1292052%2F'
    );
  });

  it('accepts apikey via query string', async () => {
    const app = createAuthApp();
    const res = await app.request('http://localhost/api/v2/info?site=unknown&sid=1&apikey=secret');

    expect(res.status).not.toBe(403);
  });

  it('accepts apikey via X-API-Key header', async () => {
    const app = createAuthApp();
    const res = await app.request('http://localhost/api/v2/info?site=unknown&sid=1', {
      headers: {
        'X-API-Key': 'secret',
      },
    });

    expect(res.status).not.toBe(403);
  });

  it('accepts apikey via Authorization bearer token', async () => {
    const app = createAuthApp();
    const res = await app.request('http://localhost/api/v2/info?site=unknown&sid=1', {
      headers: {
        Authorization: 'Bearer secret',
      },
    });

    expect(res.status).not.toBe(403);
  });

  it('keeps request rate limiting disabled when mode is off even if a threshold is configured', async () => {
    const app = createAuthApp({
      apikey: undefined,
      rateLimitMode: 'off',
      rateLimitPerMinute: 1,
    });

    const request = {
      headers: {
        'X-Forwarded-For': '203.0.113.10',
      },
    };
    const res1 = await app.request('http://localhost/api/v2/info?site=unknown&sid=1', request);
    const res2 = await app.request('http://localhost/api/v2/info?site=unknown&sid=1', request);

    expect(res1.status).not.toBe(429);
    expect(res2.status).not.toBe(429);
    expect(res1.headers.get('X-RateLimit-Limit')).toBeNull();
    expect(res2.headers.get('X-RateLimit-Limit')).toBeNull();
  });

  it('enables request rate limiting only in best-effort mode', async () => {
    const app = createAuthApp({
      apikey: undefined,
      rateLimitMode: 'best-effort',
      rateLimitPerMinute: 1,
    });

    const request = {
      headers: {
        'X-Forwarded-For': '203.0.113.11',
      },
    };
    const res1 = await app.request('http://localhost/api/v2/info?site=unknown&sid=1', request);
    const res2 = await app.request('http://localhost/api/v2/info?site=unknown&sid=1', request);

    expect(res1.status).not.toBe(429);
    expect(res1.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(res2.status).toBe(429);
    expect(res2.headers.get('X-RateLimit-Limit')).toBe('1');
  });
});
