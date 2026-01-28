import type { SitePlugin } from '../../../lib/types/plugin';
import { TmdbScraper } from './scraper';
import { TmdbNormalizer } from './normalizer';

export const tmdbPlugin: SitePlugin = {
    site: 'tmdb',
    urlPatterns: [/(?:https?:\/\/)?(?:www\.)?themoviedb\.org\/(?:(movie|tv))\/(\d+)\/?/],
    parseSid(match) {
        return `${match[1]}-${match[2]}`;
    },
    scraper: new TmdbScraper(),
    normalizer: new TmdbNormalizer(),
};

