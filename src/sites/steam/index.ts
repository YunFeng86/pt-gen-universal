import type { SitePlugin } from '../../../lib/types/plugin';
import { SteamScraper } from './scraper';
import { SteamNormalizer } from './normalizer';

export const steamPlugin: SitePlugin = {
    site: 'steam',
    urlPatterns: [/(?:https?:\/\/)?(?:store\.)?steam(?:powered|community)\.com\/app\/(\d+)\/?/],
    scraper: new SteamScraper(),
    normalizer: new SteamNormalizer(),
};

