
import { Scraper } from '../interfaces/scraper';
import { AppConfig } from '../types/config';
import { BangumiRawData } from '../types/raw-data';
import { SearchResult } from '../types/schema';
import { fetchWithTimeout } from '../utils/fetch';
import { NONE_EXIST_ERROR } from '../utils/error';

const DEFAULT_TIMEOUT_MS = 10_000;

export class BangumiScraper implements Scraper {
    async fetch(id: string, config: AppConfig): Promise<BangumiRawData> {
        const timeoutMs =
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        const bangumiLink = `https://bgm.tv/subject/${id}`;

        const [mainResp, charResp] = await Promise.all([
            fetchWithTimeout(bangumiLink, {}, timeoutMs, config),
            fetchWithTimeout(`${bangumiLink}/characters`, {}, timeoutMs, config)
        ]);

        if (!mainResp.ok) {
            if (mainResp.status === 404) {
                throw new Error(NONE_EXIST_ERROR);
            }
            throw new Error(`Bangumi request failed: ${mainResp.status} ${mainResp.statusText}`);
        }

        const mainHtml = await mainResp.text();
        if (mainHtml.includes('呜咕，出错了')) {
            throw new Error(NONE_EXIST_ERROR);
        }

        let charHtml = '';
        if (charResp.ok) {
            charHtml = await charResp.text();
        }

        return {
            site: 'bangumi',
            success: true,
            sid: id,
            main_html: mainHtml,
            characters_html: charHtml
        };
    }

    async search(query: string, config: AppConfig): Promise<SearchResult[]> {
        const timeoutMs =
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        const url = `https://api.bgm.tv/search/subject/${encodeURIComponent(query)}?responseGroup=large`;
        const response = await fetchWithTimeout(url, {}, timeoutMs, config);

        if (!response.ok) {
            throw new Error(`Bangumi search failed: ${response.status}`);
        }

        const json = await response.json();
        const list = Array.isArray(json.list) ? json.list : [];
        const tpDict: { [key: number]: string } = { 1: "漫画/小说", 2: "动画/二次元番", 3: "音乐", 4: "游戏", 6: "三次元番" };

        return list.map((d: any) => {
            const year = d.air_date ? d.air_date.slice(0, 4) : '';
            return {
                provider: 'bangumi',
                id: d.id ? String(d.id) : '',
                title: d.name_cn || d.name,
                subtitle: d.name,
                year: year,
                type: tpDict[d.type],
                link: d.url,
                poster: d.images ? (d.images.large || d.images.common) : undefined
            };
        });
    }
}
