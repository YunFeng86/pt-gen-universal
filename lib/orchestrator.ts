import { AppConfig } from './types/config';
import { MediaInfo, SearchResult } from './types/schema';
import { AppError, ErrorCode } from './errors';
import { toAppError } from './utils/app-error';
import { SitePlugin } from './types/plugin';

export class Orchestrator {
    private plugins: Map<string, SitePlugin> = new Map();
    private sortedPlugins: SitePlugin[] = [];

    constructor(private config: AppConfig, plugins: SitePlugin[] = []) {
        this.registerPlugins(plugins);
    }

    registerPlugins(plugins: SitePlugin[]) {
        for (const plugin of plugins) this.registerPlugin(plugin);
    }

    registerPlugin(plugin: SitePlugin) {
        this.plugins.set(plugin.site, plugin);
        this.rebuildSortedPlugins();
    }

    private rebuildSortedPlugins() {
        this.sortedPlugins = Array.from(this.plugins.values()).sort((a, b) => {
            const ap = a.priority ?? 0;
            const bp = b.priority ?? 0;
            return ap !== bp ? bp - ap : 0;
        });
    }

    matchUrl(url: string): { site: string; sid: string } {
        for (const plugin of this.sortedPlugins) {
            for (const pattern of plugin.urlPatterns) {
                pattern.lastIndex = 0;
                const match = pattern.exec(url);
                if (!match) continue;
                const sid = plugin.parseSid ? plugin.parseSid(match) : match[1];
                if (!sid) continue;
                return { site: plugin.site, sid };
            }
        }
        throw new AppError(ErrorCode.INVALID_PARAM, 'Unsupported URL');
    }

    async getMediaInfoByUrl(url: string): Promise<MediaInfo> {
        const { site, sid } = this.matchUrl(url);
        return this.getMediaInfo(site, sid);
    }

    async getMediaInfo(sourceName: string, id: string): Promise<MediaInfo> {
        try {
            const plugin = this.plugins.get(sourceName);
            if (!plugin) {
                // Keep legacy error message for compatibility.
                throw new AppError(ErrorCode.INVALID_PARAM, `Scraper not found: ${sourceName}`);
            }

            const rawData = await plugin.scraper.fetch(id, this.config);
            if (!rawData.success) {
                const base = toAppError(new Error(rawData.error || 'Unknown error during fetch'));
                const details = {
                    ...(base.details || {}),
                    proxy_used: rawData.proxy_used === true,
                };
                throw new AppError(base.code, base.message, details);
            }

            return plugin.normalizer.normalize(rawData, this.config);
        } catch (e) {
            throw toAppError(e);
        }
    }

    async search(sourceName: string, query: string): Promise<SearchResult[]> {
        try {
            const plugin = this.plugins.get(sourceName);
            if (!plugin) {
                throw new AppError(ErrorCode.INVALID_PARAM, `Scraper not found: ${sourceName}`);
            }
            if (plugin.supportsSearch === false) {
                throw new AppError(
                    ErrorCode.FEATURE_DISABLED,
                    `search not supported for site: ${sourceName}`
                );
            }
            return await plugin.scraper.search(query, this.config);
        } catch (e) {
            throw toAppError(e);
        }
    }
}
