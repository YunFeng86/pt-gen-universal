import type { SitePlugin } from '../../../lib/types/plugin';
import { ImdbScraper } from './scraper';
import { ImdbNormalizer } from './normalizer';

export const imdbPlugin: SitePlugin = {
    site: 'imdb',
    urlPatterns: [/(?:https?:\/\/)?(?:www\.)?imdb\.com\/title\/(tt\d+)\/?/],
    scraper: new ImdbScraper(),
    normalizer: new ImdbNormalizer(),
};

