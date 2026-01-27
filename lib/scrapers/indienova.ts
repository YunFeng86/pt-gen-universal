
import { Scraper } from '../interfaces/scraper';
import { AppConfig } from '../types/config';
import { IndienovaRawData } from '../types/raw-data';
import { SearchResult } from '../types/schema';
import { fetchWithTimeout } from '../utils/fetch';
import { NONE_EXIST_ERROR } from '../utils/error';

const DEFAULT_TIMEOUT_MS = 10_000;

export class IndienovaScraper implements Scraper {
    async fetch(id: string, config: AppConfig): Promise<IndienovaRawData> {
        const timeoutMs =
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        const url = `https://indienova.com/game/${id}`;

        const headers: any = {};
        if (config.indienovaCookie) {
            headers['Cookie'] = config.indienovaCookie;
        }

        const response = await fetchWithTimeout(url, { headers }, timeoutMs, config);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(NONE_EXIST_ERROR);
            }
            throw new Error(`Indienova request failed: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        if (html.includes('出现错误')) {
            throw new Error(NONE_EXIST_ERROR);
        }

        return {
            site: 'indienova',
            success: true,
            sid: id,
            html: html
        };
    }

    async search(query: string, config: AppConfig): Promise<SearchResult[]> {
        // Legacy didn't implement search
        return [];
    }
}
