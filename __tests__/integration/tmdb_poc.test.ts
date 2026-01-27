
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../../lib/orchestrator';
import { TmdbScraper } from '../../lib/scrapers/tmdb';
import { TmdbNormalizer } from '../../lib/normalizers/tmdb';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import * as fetchModule from '../../lib/utils/fetch';
import { TmdbRawData } from '../../lib/types/raw-data';

describe('TMDB POC Integration', () => {
    let orchestrator: Orchestrator;

    beforeEach(() => {
        vi.restoreAllMocks();
        const config = { tmdbApiKey: 'mock_key' };
        orchestrator = new Orchestrator(config);
        // Components registers are done in constructor
    });

    it('should fetch and format movie info', async () => {
        const mockResponse: TmdbRawData = {
            site: 'tmdb',
            success: true,
            tmdb_id: '101',
            id: 101,
            media_type: 'movie',
            title: 'The Matrix',
            original_title: 'The Matrix',
            release_date: '1999-03-30',
            overview: 'Welcome to the Real World.',
            vote_average: 8.7,
            vote_count: 20000,
            poster_path: '/matrix.jpg',
            genres: [{ id: 1, name: 'Sci-Fi' }, { id: 2, name: 'Action' }],
            production_countries: [{ iso_3166_1: 'US', name: 'USA' }],
            spoken_languages: [{ iso_639_1: 'en', name: 'English' }],
            runtime: 136,
            credits: {
                cast: [{ name: 'Keanu Reeves' }, { name: 'Laurence Fishburne' }],
                crew: [{ name: 'Lana Wachowski', job: 'Director' }, { name: 'Lilly Wachowski', job: 'Director' }]
            },
            external_ids: { imdb_id: 'tt0133093' },
            alternative_titles: { titles: [] }
        };

        const fetchSpy = vi.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockResponse,
            text: async () => JSON.stringify(mockResponse)
	        } as Response);
	
	        const info = await orchestrator.getMediaInfo('tmdb', '101');
	        const result = new BBCodeFormatter().format(info);

        expect(result).toContain('◎片　　名　The Matrix');
        expect(result).toContain('◎年　　代　1999');
        expect(result).toContain('◎产　　地　USA');
        expect(result).toContain('◎类　　别　Sci-Fi / Action');
        expect(result).toContain('◎TMDB评分　8.7/10 from 20000 users');
        expect(result).toContain('◎导　　演　Lana Wachowski / Lilly Wachowski');
        expect(result).toContain('◎主　　演　Keanu Reeves');
        expect(result).toContain('◎简　　介');
        expect(result).toContain('Welcome to the Real World.');

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('api.themoviedb.org/3/movie/101'),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
    });

    it('should handle search queries', async () => {
        const mockSearchResponse = {
            success: true,
            results: [
                {
                    media_type: 'movie',
                    id: 101,
                    title: 'The Matrix',
                    release_date: '1999-03-30',
                    poster_path: '/matrix.jpg'
                }
            ]
        };

        const fetchSpy = vi.spyOn(fetchModule, 'fetchWithTimeout').mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => mockSearchResponse
        } as Response);

        const results = await orchestrator.search('tmdb', 'Matrix');

        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('The Matrix');
        expect(results[0].id).toBe('movie-101');

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/search/multi'),
            expect.anything(),
            expect.anything(),
            expect.anything()
        );
    });
});
