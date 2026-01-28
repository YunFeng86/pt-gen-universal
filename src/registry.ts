import type { SitePlugin } from '../lib/types/plugin';
import { bangumiPlugin } from './sites/bangumi';
import { doubanPlugin } from './sites/douban';
import { gogPlugin } from './sites/gog';
import { imdbPlugin } from './sites/imdb';
import { indienovaPlugin } from './sites/indienova';
import { steamPlugin } from './sites/steam';
import { tmdbPlugin } from './sites/tmdb';

export const DEFAULT_SITE_PLUGINS: SitePlugin[] = [
    doubanPlugin,
    tmdbPlugin,
    imdbPlugin,
    bangumiPlugin,
    steamPlugin,
    gogPlugin,
    indienovaPlugin,
];

