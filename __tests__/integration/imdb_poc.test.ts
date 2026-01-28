
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../../lib/orchestrator';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import * as fetchModule from '../../lib/utils/fetch';
import { imdbPlugin } from '../../src/sites/imdb';

describe('IMDb POC Integration', () => {
    let orchestrator: Orchestrator;

    beforeEach(() => {
        vi.restoreAllMocks();
        const config = {};
        orchestrator = new Orchestrator(config, [imdbPlugin]);
    });

    it('should fetch and format imdb movie info', async () => {
        const mockMainHtml = `
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "http://schema.org",
                    "@type": "Movie",
                    "name": "Inception",
                    "image": "https://example.com/inception.jpg",
                    "description": "A thief who steals corporate secrets...",
                    "aggregateRating": {
                        "ratingValue": "8.8",
                        "ratingCount": "2000000"
                    },
                    "datePublished": "2010-07-16",
                    "genre": "Action",
                    "director": { "@type": "Person", "name": "Christopher Nolan" },
                    "creator": { "@type": "Person", "name": "Christopher Nolan" },
                    "actor": [
                        { "@type": "Person", "name": "Leonardo DiCaprio" },
                        { "@type": "Person", "name": "Joseph Gordon-Levitt" }
                    ]
                }
                </script>
            </head>
            <body>
            </body>
            </html>
        `;

        const mockReleaseHtml = `
            <html>
            <body>
                <tr class="release-date-item">
                    <td class="release-date-item__country-name">USA</td>
                    <td class="release-date-item__date">16 July 2010</td>
                </tr>
                <tr class="aka-item">
                    <td class="aka-item__name">China</td>
                    <td class="aka-item__title">盗梦空间</td>
                </tr>
            </body>
            </html>
        `;

        const fetchSpy = vi.spyOn(fetchModule, 'fetchWithTimeout').mockImplementation(async (url) => {
            if (url.endsWith('releaseinfo')) {
                return {
                    ok: true,
                    status: 200,
                    text: async () => mockReleaseHtml
                } as Response;
            }
            if (url.includes('www.imdb.com/title/')) {
                return {
                    ok: true,
                    status: 200,
                    text: async () => mockMainHtml
                } as Response;
            }
            return { ok: false, status: 404 } as Response;
        });

        const info = await orchestrator.getMediaInfo('imdb', 'tt1375666');
        const result = new BBCodeFormatter().format(info);

        expect(result).toContain('Inception');
        expect(result).toContain('2010');
        expect(result).toContain('8.8/10 from 2000000 users');
        expect(result).toContain('Christopher Nolan');
        expect(result).toContain('Leonardo DiCaprio');

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle search queries', async () => {
        const mockSearchResponse = {
            d: [
                { id: 'tt1375666', l: 'Inception', y: 2010, q: 'feature', i: { imageUrl: 'cover.jpg' } }
            ]
        };

        const fetchSpy = vi.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockSearchResponse
        } as Response);

        const results = await orchestrator.search('imdb', 'Inception');

        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Inception');
        expect(results[0].id).toBe('tt1375666');
    });
});
