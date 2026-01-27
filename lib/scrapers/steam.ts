
import { Scraper } from '../interfaces/scraper';
import { AppConfig } from '../types/config';
import { SteamRawData } from '../types/raw-data';
import { SearchResult } from '../types/schema';
import { fetchWithTimeout } from '../utils/fetch';
import { NONE_EXIST_ERROR } from '../utils/error';

const DEFAULT_TIMEOUT_MS = 10_000;

export class SteamScraper implements Scraper {
    async fetch(id: string, config: AppConfig): Promise<SteamRawData> {
        const timeoutMs =
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        const steamUrl = `https://store.steampowered.com/app/${id}/?l=schinese`;

        // Use cookies to bypass age check and force language
        const headers = {
            "Cookie": "lastagecheckage=1-January-1975; birthtime=157737601; mature_content=1; wants_mature_content=1; Steam_Language=schinese"
        };

        const [pageResp, steamCnResp] = await Promise.all([
            fetchWithTimeout(steamUrl, { headers, redirect: 'manual' }, timeoutMs, config),
            fetchWithTimeout(`https://steamdb.keylol.com/app/${id}/data.js?v=38`, {}, timeoutMs, config)
        ]);

        if (pageResp.status === 302) {
            return {
                site: 'steam',
                sid: id,
                success: false,
                error: NONE_EXIST_ERROR
            };
        }
        if (pageResp.status === 403) {
            return {
                site: 'steam',
                sid: id,
                success: false,
                error: "GenHelp was temporary banned by Steam Server, Please wait...."
            };
        }
        if (!pageResp.ok) {
            return {
                site: 'steam',
                sid: id,
                success: false,
                error: `Steam request failed: ${pageResp.status} ${pageResp.statusText}`
            };
        }

        const mainHtml = await pageResp.text();

        let steamCnData = {};
        if (steamCnResp.ok) {
            const text = await steamCnResp.text();
            // JSONP parser logic: match(/[^(]+\((.+)\)/)[1]
            try {
                const match = text.replace(/\n/ig, '').match(/[^(]+\((.+)\)/);
                if (match && match[1]) {
                    steamCnData = JSON.parse(match[1]);
                }
            } catch { }
        }

        return {
            site: 'steam',
            success: true,
            sid: id,
            main_html: mainHtml,
            steamcn_data: steamCnData
        };
    }

    async search(query: string, config: AppConfig): Promise<SearchResult[]> {
        const timeoutMs =
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=schinese&cc=CN`;
        try {
            const response = await fetchWithTimeout(url, {}, timeoutMs, config);
            if (response.ok) {
                const json = await response.json();
                if (json.items) {
                    return json.items.map((item: any) => ({
                        provider: 'steam',
                        id: String(item.id),
                        title: item.name,
                        link: `https://store.steampowered.com/app/${item.id}`,
                        poster: item.tiny_image
                    }));
                }
            }
        } catch { }
        return [];
    }
}
