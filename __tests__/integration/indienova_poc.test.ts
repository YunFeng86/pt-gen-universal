
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../../lib/orchestrator';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import * as fetchModule from '../../lib/utils/fetch';
import { indienovaPlugin } from '../../src/sites/indienova';

describe('Indienova POC Integration', () => {
    let orchestrator: Orchestrator;

    beforeEach(() => {
        vi.restoreAllMocks();
        const config = {};
        orchestrator = new Orchestrator(config, [indienovaPlugin]);
    });

    it('should fetch and format indienova game info', async () => {
        const mockHtml = `
            <title>Game Title - Indienova</title>
            <div class="title-holder"><h1><span>Game Title</span></h1></div>
            <div id="tabs-intro"><div class="bottommargin-sm">Description</div></div>
        `;

        const fetchSpy = vi.spyOn(fetchModule, 'fetchWithTimeout').mockImplementation(async (url) => {
            if (url.includes('indienova.com/game/')) {
                return { ok: true, status: 200, text: async () => mockHtml } as Response;
            }
            return { ok: false, status: 404 } as Response;
        });

        const info = await orchestrator.getMediaInfo('indienova', 'game-id');
        const result = new BBCodeFormatter().format(info);

        expect(result).toContain('Game Title');
        expect(result).toContain('Description');

        expect(fetchSpy).toHaveBeenCalled();
    });
});
