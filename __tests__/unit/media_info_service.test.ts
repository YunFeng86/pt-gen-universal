import { describe, expect, it, vi } from 'vitest';
import type { MediaInfo } from '../../lib/types/schema';
import { AppError } from '../../lib/errors';
import { MediaInfoService } from '../../src/services/media-info';

const fakeInfo: MediaInfo = {
  site: 'douban',
  id: '1292052',
  chinese_title: '肖申克的救赎',
  foreign_title: 'The Shawshank Redemption',
  aka: [],
  trans_title: [],
  this_title: [],
  year: '1994',
  playdate: ['1994-09-23'],
  region: ['美国'],
  genre: ['剧情'],
  language: ['英语'],
  duration: '142分钟',
  episodes: '',
  seasons: '',
  poster: 'https://example.com/poster.jpg',
  director: ['Frank Darabont'],
  writer: ['Stephen King'],
  cast: ['Tim Robbins'],
  introduction: '希望让人自由',
  awards: '',
  tags: [],
};

describe('MediaInfoService', () => {
  it('优先使用 url 解析资源并拉取信息', async () => {
    const orchestrator = {
      matchUrl: vi.fn().mockReturnValue({ site: 'douban', sid: '1292052' }),
      getMediaInfo: vi.fn().mockResolvedValue(fakeInfo),
    } as any;
    const service = new MediaInfoService(orchestrator);

    const result = await service.resolve({
      url: 'https://movie.douban.com/subject/1292052/',
      site: 'ignored',
      sid: 'ignored',
    });

    expect(orchestrator.matchUrl).toHaveBeenCalledWith('https://movie.douban.com/subject/1292052/');
    expect(orchestrator.getMediaInfo).toHaveBeenCalledWith('douban', '1292052');
    expect(result).toMatchObject({
      site: 'douban',
      sid: '1292052',
      info: fakeInfo,
    });
  });

  it('支持直接使用 site/sid 解析资源', async () => {
    const orchestrator = {
      matchUrl: vi.fn(),
      getMediaInfo: vi.fn().mockResolvedValue(fakeInfo),
    } as any;
    const service = new MediaInfoService(orchestrator);

    const result = await service.resolve({ site: 'douban', sid: '1292052' });

    expect(orchestrator.matchUrl).not.toHaveBeenCalled();
    expect(orchestrator.getMediaInfo).toHaveBeenCalledWith('douban', '1292052');
    expect(result.sid).toBe('1292052');
  });

  it('缺少定位信息时抛出 INVALID_PARAM', async () => {
    const service = new MediaInfoService({} as any);

    await expect(service.resolve({})).rejects.toBeInstanceOf(AppError);
    await expect(service.resolve({})).rejects.toMatchObject({
      code: 'INVALID_PARAM',
    });
  });

  it('生成三种格式的输出', () => {
    const service = new MediaInfoService({} as any);
    const formats = service.renderFormats(fakeInfo);

    expect(formats.bbcode).toContain('◎年　　代　1994');
    expect(formats.markdown).toContain('## 基本信息');
    expect(formats.json).toContain('"site": "douban"');
  });

  it('json 格式不重复附加文本输出', () => {
    const service = new MediaInfoService({} as any);

    expect(service.renderFormat(fakeInfo, 'json')).toBeUndefined();
    expect(service.renderFormat(fakeInfo, 'bbcode')).toContain('◎年　　代　1994');
    expect(service.renderFormat(fakeInfo, 'markdown')).toContain('## 基本信息');
  });

  it('透传下游异常，交给上层统一映射', async () => {
    const orchestrator = {
      getMediaInfo: vi.fn().mockRejectedValue(new Error('boom')),
    } as any;
    const service = new MediaInfoService(orchestrator);

    await expect(service.resolve({ site: 'douban', sid: '1292052' })).rejects.toThrow('boom');
  });
});
