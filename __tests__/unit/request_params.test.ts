import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { AppError } from '../../lib/errors';
import { extractRequestParams } from '../../src/utils/request-params';

function createRequestParamsApp() {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
          },
        },
        err.httpStatus as any
      );
    }

    return c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: (err as Error).message,
        },
      },
      500
    );
  });

  app.get('/api/v2/info', async (c) => c.json(await extractRequestParams(c)));
  app.post('/api/v2/info', async (c) => c.json(await extractRequestParams(c)));
  app.post('/api/v2/info/:site/:sid', async (c) => c.json(await extractRequestParams(c)));

  return app;
}

describe('extractRequestParams', () => {
  const app = createRequestParamsApp();

  it('路径路由始终以 path 中的 site/sid 为准，但允许 body 覆盖 format', async () => {
    const res = await app.request('/api/v2/info/path-site/path-sid?format=markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://movie.douban.com/subject/1292052/',
        site: 'body-site',
        sid: 'body-sid',
        format: 'bbcode',
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      site: 'path-site',
      sid: 'path-sid',
      format: 'bbcode',
    });
  });

  it('非路径路由保持 body > query，且 url 优先于 site/sid', async () => {
    const res = await app.request('/api/v2/info?url=https://example.com/wrong&format=bbcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://movie.douban.com/subject/1292052/',
        site: 'body-site',
        sid: 'body-sid',
        format: 'markdown',
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: 'https://movie.douban.com/subject/1292052/',
      format: 'markdown',
    });
  });

  it('空 body 会回退到 query 参数', async () => {
    const res = await app.request('/api/v2/info?site=douban&sid=1292052&format=json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      site: 'douban',
      sid: '1292052',
      format: 'json',
    });
  });

  it('非法 JSON body 返回 INVALID_PARAM', async () => {
    const res = await app.request('/api/v2/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: {
        code: 'INVALID_PARAM',
      },
    });
  });
});
