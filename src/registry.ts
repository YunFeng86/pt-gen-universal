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

const SEARCH_SITE_DISPLAY_ORDER = ['douban', 'imdb', 'bangumi', 'tmdb', 'steam', 'gog'] as const;
const SEARCH_SITE_DISPLAY_INDEX = new Map(
  SEARCH_SITE_DISPLAY_ORDER.map((site, index) => [site, index])
);

export const SEARCHABLE_SITE_PLUGINS: SitePlugin[] = DEFAULT_SITE_PLUGINS.filter(
  (plugin) => plugin.supportsSearch !== false
).sort(
  (left, right) =>
    (SEARCH_SITE_DISPLAY_INDEX.get(left.site as (typeof SEARCH_SITE_DISPLAY_ORDER)[number]) ??
      Number.MAX_SAFE_INTEGER) -
    (SEARCH_SITE_DISPLAY_INDEX.get(right.site as (typeof SEARCH_SITE_DISPLAY_ORDER)[number]) ??
      Number.MAX_SAFE_INTEGER)
);

export const SEARCHABLE_SITE_IDS: string[] = SEARCHABLE_SITE_PLUGINS.map((plugin) => plugin.site);
