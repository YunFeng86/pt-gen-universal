
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../../lib/orchestrator';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import * as fetchModule from '../../lib/utils/fetch';
import { bangumiPlugin } from '../../src/sites/bangumi';

describe('Bangumi POC Integration', () => {
    let orchestrator: Orchestrator;

    beforeEach(() => {
        vi.restoreAllMocks();
        const config = {};
        orchestrator = new Orchestrator(config, [bangumiPlugin]);
    });

    it('should fetch and format bangumi info', async () => {
        const mockMainHtml = `
            <h1 class="nameSingle"><a href="/subject/1">Cowboy Bebop</a></h1>
            <div id="bangumiInfo">
                <a href="/cover/c/1.jpg" class="thickbox cover"></a>
                <ul id="infobox">
                    <li>中文名: 星际牛仔</li>
                    <li>放送开始: 1998-04-03</li>
                </ul>
            </div>
            <div id="subject_summary">Space Jazzy Blues</div>
        `;

        const fetchSpy = vi.spyOn(fetchModule, 'fetchWithTimeout').mockImplementation(async (url) => {
            if (url.includes('/characters')) {
                return { ok: true, status: 200, text: async () => '' } as Response;
            }
            if (url.includes('bgm.tv/subject/')) {
                return { ok: true, status: 200, text: async () => mockMainHtml } as Response;
            }
            return { ok: false, status: 404 } as Response;
        });

        const info = await orchestrator.getMediaInfo('bangumi', '1');
        const result = new BBCodeFormatter().format(info);

        expect(result).toContain('星际牛仔'); // Chinese title priority in Bangumi
        expect(result).toContain('1998');
        expect(result).toContain('Space Jazzy Blues');

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle search queries', async () => {
        const mockSearchResponse = {
            list: [
                { id: 1, name: 'Cowboy Bebop', name_cn: '星际牛仔', type: 2, air_date: '1998-04-03', url: 'http://bgm.tv/subject/1' }
            ]
        };

        const fetchSpy = vi.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockSearchResponse
        } as Response);

        const results = await orchestrator.search('bangumi', 'Cowboy Bebop');

        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('星际牛仔');
        expect(results[0].id).toBe('1');
        expect(results[0].type).toBe('动画/二次元番');
    });
});
