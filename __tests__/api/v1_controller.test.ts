import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { V1Controller } from '../../src/controllers/v1';
import type { MediaInfoService } from '../../src/services/media-info';

function makeTestApp(v1: V1Controller) {
  const app = new Hono();
  app.get('/api/v1/info', (c) => v1.handleInfo(c));
  app.get('/api/v1/info/:site/:sid', (c) => v1.handleInfo(c));
  return app;
}

describe('API v1 controller contract', () => {
  const fakeInfo: any = {
    site: 'douban',
    id: '1292052',
    chinese_title: '肖申克的救赎',
    foreign_title: 'The Shawshank Redemption',
    trans_title: '肖申克的救赎',
    this_title: 'The Shawshank Redemption',
    year: '1994',
    region: ['美国'],
    genre: ['剧情'],
    language: ['英语'],
    playdate: ['1994-09-10'],
    director: ['弗兰克·德拉邦特'],
    writer: ['斯蒂芬·金'],
    cast: ['蒂姆·罗宾斯', '摩根·弗里曼'],
    introduction: 'test intro',
  };

  function createController() {
    const mediaInfoService = {
      resolve: async () => ({ site: 'douban', sid: '1292052', info: fakeInfo }),
      renderFormats: (info: any) => ({
        bbcode: `bbcode:${info.director.join('/')}`,
        markdown: 'markdown',
        json: JSON.stringify(info),
      }),
      renderFormat: () => undefined,
    } as unknown as MediaInfoService;

    const v1 = new V1Controller({} as any, mediaInfoService, {} as any);
    return makeTestApp(v1);
  }

  it('returns director/writer/cast as { name } object arrays for legacy client compat', async () => {
    const app = createController();
    const res = await app.request('http://localhost/api/v1/info/douban/1292052');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.director).toEqual([{ name: '弗兰克·德拉邦特' }]);
    expect(body.writer).toEqual([{ name: '斯蒂芬·金' }]);
    expect(body.cast).toEqual([{ name: '蒂姆·罗宾斯' }, { name: '摩根·弗里曼' }]);
  });

  it('keeps the internal director array for BBCode formatting', async () => {
    const app = createController();
    const res = await app.request('http://localhost/api/v1/info/douban/1292052');
    const body = await res.json();

    expect(body.format).toContain('bbcode:弗兰克·德拉邦特');
    expect(body.format).not.toContain('[object Object]');
  });
});
