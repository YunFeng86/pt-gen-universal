import type { SitePlugin } from '../../../lib/types/plugin';
import { DoubanScraper } from './scraper';
import { DoubanNormalizer } from './normalizer';

export const doubanPlugin: SitePlugin = {
    site: 'douban',
    urlPatterns: [
        /(?:https?:\/\/)?(?:(?:movie|www|m)\.)?douban\.com\/(?:(?:movie\/)?subject|movie)\/(\d+)\/?/,
    ],
    scraper: new DoubanScraper(),
    normalizer: new DoubanNormalizer(),
};

