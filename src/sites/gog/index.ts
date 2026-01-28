import type { SitePlugin } from '../../../lib/types/plugin';
import { GogScraper } from './scraper';
import { GogNormalizer } from './normalizer';

export const gogPlugin: SitePlugin = {
    site: 'gog',
    urlPatterns: [/(?:https?:\/\/)?(?:www\.)?gog\.com\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?game\/([\w-]+)/],
    scraper: new GogScraper(),
    normalizer: new GogNormalizer(),
};

