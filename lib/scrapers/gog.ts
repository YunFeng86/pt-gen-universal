
import { Scraper } from '../interfaces/scraper';
import { AppConfig } from '../types/config';
import { GogRawData } from '../types/raw-data';
import { SearchResult } from '../types/schema';
import { fetchWithTimeout } from '../utils/fetch';
import { NONE_EXIST_ERROR } from '../utils/error';

const DEFAULT_TIMEOUT_MS = 10_000;

export class GogScraper implements Scraper {
    private async resolveGogId(sid: string, timeoutMs: number, config: AppConfig): Promise<string> {
        if (/^\d+$/.test(sid)) {
            return sid;
        }

        const url = `https://catalog.gog.com/v1/catalog?query=${encodeURIComponent(sid)}`;
        const response = await fetchWithTimeout(url, {}, timeoutMs, config);

        if (!response.ok) {
            throw new Error(`GOG Catalog API returned status ${response.status}`);
        }

        const json = await response.json();
        if (!json.products || json.products.length === 0) {
            throw new Error(NONE_EXIST_ERROR);
        }

        const matched = json.products.find((p: any) => p.slug === sid);
        if (!matched) {
            throw new Error(NONE_EXIST_ERROR);
        }

        return String(matched.id);
    }

    async fetch(id: string, config: AppConfig): Promise<GogRawData> {
        const timeoutMs =
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        let gogId: string;
        try {
            gogId = await this.resolveGogId(id, timeoutMs, config);
        } catch (e: any) {
            throw new Error(e.message || NONE_EXIST_ERROR);
        }

        const apiUrl = `https://api.gog.com/products/${gogId}?expand=description,screenshots,videos`;
        const apiResp = await fetchWithTimeout(apiUrl, {}, timeoutMs, config);

        if (apiResp.status === 404) {
            throw new Error(NONE_EXIST_ERROR);
        }
        if (!apiResp.ok) {
            throw new Error(`GOG API returned status ${apiResp.status}`);
        }

        const apiData = await apiResp.json();
        const slug = apiData.slug;
        let storeHtml = '';

        if (slug) {
            const pageUrl = `https://www.gog.com/en/game/${slug}`;
            const pageResp = await fetchWithTimeout(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, timeoutMs, config);

            if (pageResp.ok) {
                storeHtml = await pageResp.text();
            }
        }

        return {
            site: 'gog',
            success: true,
            sid: id,
            gog_id: gogId,
            api_data: apiData,
            store_page_html: storeHtml,
        };
    }

    async search(query: string, config: AppConfig): Promise<SearchResult[]> {
        const timeoutMs =
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        const url = `https://catalog.gog.com/v1/catalog?query=${encodeURIComponent(query)}`;
        try {
            const response = await fetchWithTimeout(url, {}, timeoutMs, config);
            if (response.ok) {
                const json = await response.json();
                if (json.products) {
                    return json.products.map((item: any) => ({
                        provider: 'gog',
                        id: item.slug, // Use slug as ID for better user readability? Or ID? Legacy gen_gog accepts slug.
                        // Scraper.fetch handles slug or ID.
                        title: item.title,
                        link: `https://www.gog.com/en/game/${item.slug}`,
                        poster: item.cover_horizontal // or boxArtImage if available in this API? Catalog API returns simplified object.
                    }));
                }
            }
        } catch { }
        return [];
    }
}
