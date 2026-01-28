
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../../lib/orchestrator';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import * as fetchModule from '../../lib/utils/fetch';
import { gogPlugin } from '../../src/sites/gog';

describe('GOG POC Integration', () => {
    let orchestrator: Orchestrator;

    beforeEach(() => {
        vi.restoreAllMocks();
        const config = {};
        orchestrator = new Orchestrator(config, [gogPlugin]);
    });

    it('should fetch and format gog game info', async () => {
        const mockApiJson = {
            id: 12345,
            title: "Cyberpunk 2077",
            slug: "cyberpunk_2077",
            description: { lead: "Wake up samurai" }
        };
        const mockStoreHtml = `
            cardProduct: {
                "boxArtImage": "https://example.com/cp2077.jpg",
                "supportedOperatingSystems": []
            }
        `;

        const fetchSpy = vi.spyOn(fetchModule, 'fetchWithTimeout').mockImplementation(async (url) => {
            if (url.includes('catalog.gog.com')) {
                // Mock resolve ID if needed, but if we pass numeric ID it skips.
                // If we pass slug it searches.
                return { ok: true, status: 200, json: async () => ({ products: [{ slug: 'cp2077', id: 12345 }] }) } as Response;
            }
            if (url.includes('api.gog.com')) {
                return { ok: true, status: 200, json: async () => mockApiJson } as Response;
            }
            if (url.includes('www.gog.com/en/game/')) {
                return { ok: true, status: 200, text: async () => mockStoreHtml } as Response;
            }
            return { ok: false, status: 404 } as Response;
        });

        const info = await orchestrator.getMediaInfo('gog', '12345');
        const result = new BBCodeFormatter().format(info);

        expect(result).toContain('Cyberpunk 2077');
        expect(result).toContain('Wake up samurai');

        expect(fetchSpy).toHaveBeenCalled();
    });
});
