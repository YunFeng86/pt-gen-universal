import type { SitePlugin } from '../../../lib/types/plugin';
import { BangumiScraper } from './scraper';
import { BangumiNormalizer } from './normalizer';

export const bangumiPlugin: SitePlugin = {
    site: 'bangumi',
    urlPatterns: [/(?:https?:\/\/)?(?:bgm\.tv|bangumi\.tv|chii\.in)\/subject\/(\d+)\/?/],
    scraper: new BangumiScraper(),
    normalizer: new BangumiNormalizer(),
};

