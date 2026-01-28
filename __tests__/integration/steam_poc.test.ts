
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../../lib/orchestrator';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import * as fetchModule from '../../lib/utils/fetch';
import { steamPlugin } from '../../src/sites/steam';

describe('Steam POC Integration', () => {
    let orchestrator: Orchestrator;

    beforeEach(() => {
        vi.restoreAllMocks();
        const config = {};
        orchestrator = new Orchestrator(config, [steamPlugin]);
    });

    it('should fetch and format steam game info', async () => {
        const mockMainHtml = `
            <div class="apphub_AppName">Half-Life 2</div>
            <div class="details_block">
                <b>名称:</b> Half-Life 2<br>
                <b>发行日期:</b> 2004年11月16日
            </div>
            <div id="game_area_description">Best FPS ever</div>
        `;

        const fetchSpy = vi.spyOn(fetchModule, 'fetchWithTimeout').mockImplementation(async (url) => {
            if (url.includes('steamdb.keylol.com')) {
                return { ok: true, status: 200, text: async () => 'some_callback({ "name_cn": "半条命2" })' } as Response;
            }
            if (url.includes('store.steampowered.com/app/')) {
                return { ok: true, status: 200, text: async () => mockMainHtml } as Response;
            }
            return { ok: false, status: 404 } as Response;
        });

        const info = await orchestrator.getMediaInfo('steam', '220');
        const result = new BBCodeFormatter().format(info);

        expect(result).toContain('半条命2');
        expect(result).toContain('Half-Life 2');
        expect(result).toContain('2004');

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
});
