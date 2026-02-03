import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { V2Controller } from '../../src/controllers/v2';
import { Orchestrator } from '../../lib/orchestrator';
import { AppConfig } from '../../lib/types/config';
import { MediaInfo } from '../../lib/types/schema';
import { AppError } from '../../lib/errors';

describe('V2Controller - 参数解析', () => {
    let controller: V2Controller;
    let mockOrchestrator: Orchestrator;
    let app: Hono;

    const mockMediaInfo: MediaInfo = {
        site: 'douban',
        id: '1292052',
        chinese_title: '肖申克的救赎',
        foreign_title: 'The Shawshank Redemption',
        aka: [],
        trans_title: [],
        this_title: [],
        year: '1994',
        playdate: ['1994-09-23(美国)'],
        region: ['美国'],
        genre: ['剧情', '犯罪'],
        language: ['英语'],
        duration: '142分钟',
        episodes: '',
        seasons: '',
        poster: 'https://example.com/poster.jpg',
        director: ['弗兰克·德拉邦特'],
        writer: ['斯蒂芬·金'],
        cast: ['蒂姆·罗宾斯', '摩根·弗里曼'],
        introduction: '希望让人自由',
        awards: '',
        tags: []
    };

    beforeEach(() => {
        const config: AppConfig = {};
        mockOrchestrator = {
            matchUrl: vi.fn().mockReturnValue({ site: 'douban', sid: '1292052' }),
            getMediaInfo: vi.fn().mockResolvedValue(mockMediaInfo),
        } as any;

        controller = new V2Controller(mockOrchestrator, config);
        app = new Hono();
        // Match src/app.ts error shape for v2 (otherwise thrown AppError becomes 500).
        app.onError((err, c) => {
            if (err instanceof AppError) {
                return c.json(
                    {
                        error: {
                            code: err.code,
                            message: err.message
                        }
                    },
                    err.httpStatus as any
                );
            }
            return c.json(
                {
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: (err as any)?.message || 'Internal Server Error'
                    }
                },
                500
            );
        });
        app.get('/api/v2/info', (c) => controller.handleInfo(c));
        app.post('/api/v2/info', (c) => controller.handleInfo(c));
        app.get('/api/v2/info/:site/:sid', (c) => controller.handleInfo(c));
        app.post('/api/v2/info/:site/:sid', (c) => controller.handleInfo(c));
    });

    describe('GET 请求 - Query 参数', () => {
        it('应该解析 url 参数', async () => {
            const res = await app.request('/api/v2/info?url=https://movie.douban.com/subject/1292052/');
            expect(res.status).toBe(200);
            expect(mockOrchestrator.matchUrl).toHaveBeenCalledWith('https://movie.douban.com/subject/1292052/');
        });

        it('应该解析 site/sid 参数', async () => {
            const res = await app.request('/api/v2/info?site=douban&sid=1292052');
            expect(res.status).toBe(200);
            expect(mockOrchestrator.getMediaInfo).toHaveBeenCalledWith('douban', '1292052');
        });

        it('应该默认返回 JSON 格式', async () => {
            const res = await app.request('/api/v2/info?url=https://movie.douban.com/subject/1292052/');
            const json = await res.json();
            expect(json.data.format).toBeUndefined(); // JSON 格式时 format 字段为空
        });

        it('应该支持 format=bbcode', async () => {
            const res = await app.request('/api/v2/info?url=https://movie.douban.com/subject/1292052/&format=bbcode');
            const json = await res.json();
            expect(json.data.format).toBeDefined();
            expect(typeof json.data.format).toBe('string');
        });
    });

    describe('RESTful 路径参数', () => {
        it('应该解析 /api/v2/info/:site/:sid', async () => {
            const res = await app.request('/api/v2/info/douban/1292052');
            expect(res.status).toBe(200);
            expect(mockOrchestrator.getMediaInfo).toHaveBeenCalledWith('douban', '1292052');
        });

        it('路径参数应该覆盖 query 参数', async () => {
            const res = await app.request('/api/v2/info/imdb/tt0111161?site=douban&sid=1292052');
            expect(res.status).toBe(200);
            // 应该使用路径参数 imdb/tt0111161，而不是 query 的 douban/1292052
            expect(mockOrchestrator.getMediaInfo).toHaveBeenCalledWith('imdb', 'tt0111161');
        });
    });

    describe('POST 请求 - JSON Body', () => {
        it('应该解析 JSON body 中的 url', async () => {
            const res = await app.request('/api/v2/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://movie.douban.com/subject/1292052/' })
            });
            expect(res.status).toBe(200);
            expect(mockOrchestrator.matchUrl).toHaveBeenCalledWith('https://movie.douban.com/subject/1292052/');
        });

        it('应该解析 JSON body 中的 site/sid', async () => {
            const res = await app.request('/api/v2/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site: 'douban', sid: '1292052' })
            });
            expect(res.status).toBe(200);
            expect(mockOrchestrator.getMediaInfo).toHaveBeenCalledWith('douban', '1292052');
        });

        it('应该解析 JSON body 中的 format', async () => {
            const res = await app.request('/api/v2/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://movie.douban.com/subject/1292052/',
                    format: 'markdown'
                })
            });
            const json = await res.json();
            expect(json.data.format).toBeDefined();
        });

        it('body 参数应该覆盖 query 参数', async () => {
            const res = await app.request('/api/v2/info?url=https://example.com/wrong', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://movie.douban.com/subject/1292052/' })
            });
            expect(res.status).toBe(200);
            // 应该使用 body 的 url
            expect(mockOrchestrator.matchUrl).toHaveBeenCalledWith('https://movie.douban.com/subject/1292052/');
        });
    });

    describe('边界情况处理', () => {
        it('POST 空 body 应该回退到 query 参数', async () => {
            const res = await app.request('/api/v2/info?url=https://movie.douban.com/subject/1292052/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: ''
            });
            expect(res.status).toBe(200);
            expect(mockOrchestrator.matchUrl).toHaveBeenCalledWith('https://movie.douban.com/subject/1292052/');
        });

        it('POST 非 JSON body 应该静默忽略', async () => {
            const res = await app.request('/api/v2/info?url=https://movie.douban.com/subject/1292052/', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: 'plain text'
            });
            expect(res.status).toBe(200);
            // 应该回退到 query 参数
            expect(mockOrchestrator.matchUrl).toHaveBeenCalledWith('https://movie.douban.com/subject/1292052/');
        });

        it('POST 看起来像 JSON 但解析失败应该抛错', async () => {
            const res = await app.request('/api/v2/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{ invalid json'
            });
            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error.code).toBe('INVALID_PARAM');
        });

        it('缺少 url 和 site/sid 应该返回 400', async () => {
            const res = await app.request('/api/v2/info');
            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error.message).toContain('url');
        });

        it('无效的 format 参数应该返回 400', async () => {
            const res = await app.request('/api/v2/info?url=https://movie.douban.com/subject/1292052/&format=invalid');
            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error.code).toBe('INVALID_PARAM');
        });

        it('Content-Type 包含 +json 应该被识别', async () => {
            const res = await app.request('/api/v2/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/vnd.api+json' },
                body: JSON.stringify({ url: 'https://movie.douban.com/subject/1292052/' })
            });
            expect(res.status).toBe(200);
        });
    });

    describe('参数优先级验证', () => {
        it('完整优先级：body > path > query', async () => {
            const res = await app.request('/api/v2/info/path-site/path-sid?site=query-site&sid=query-sid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site: 'body-site', sid: 'body-sid' })
            });
            expect(res.status).toBe(200);
            // 应该使用 body 的参数
            expect(mockOrchestrator.getMediaInfo).toHaveBeenCalledWith('body-site', 'body-sid');
        });

        it('部分参数优先级：body.url + query.format', async () => {
            const res = await app.request('/api/v2/info?format=bbcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://movie.douban.com/subject/1292052/' })
            });
            const json = await res.json();
            expect(json.data.format).toBeDefined(); // format=bbcode 生效
        });
    });
});
