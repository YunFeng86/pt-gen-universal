import type { SitePlugin } from '../../../lib/types/plugin';
import { IndienovaScraper } from './scraper';
import { IndienovaNormalizer } from './normalizer';

export const indienovaPlugin: SitePlugin = {
    site: 'indienova',
    urlPatterns: [
        // Keep the slug bounded to avoid swallowing extra path/query fragments.
        /(?:https?:\/\/)?indienova\.com\/(?:game|g)\/([^/?#]+)(?:[/?#]|$)/,
    ],
    scraper: new IndienovaScraper(),
    normalizer: new IndienovaNormalizer(),
};

