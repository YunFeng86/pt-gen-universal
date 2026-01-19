
import { Scraper } from '../interfaces/scraper';
import { AppConfig } from '../types/config';
import { ImdbRawData } from '../types/raw-data';
import { SearchResult } from '../types/schema';
import { fetchWithTimeout } from '../utils/fetch';
import { NONE_EXIST_ERROR } from '../utils/error';
import * as cheerio from 'cheerio';
// import { pageParser } from '../utils/html'; // Use existing utility if available

export class ImdbScraper implements Scraper {
    async fetch(id: string, config: AppConfig): Promise<ImdbRawData> {
        let imdbId = id;
        if (imdbId.startsWith("tt")) {
            imdbId = imdbId.slice(2);
        }
        // Pad to 7 digits
        imdbId = "tt" + imdbId.padStart(7, "0");
        const imdbUrl = `https://www.imdb.com/title/${imdbId}/`;

        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        };

        // Fetch Main Page and Release Info Page concurrently
        const [mainResp, releaseResp] = await Promise.all([
            fetchWithTimeout(imdbUrl, { headers }, config.doubanTimeoutMs || 10000),
            fetchWithTimeout(`${imdbUrl}releaseinfo`, { headers }, config.doubanTimeoutMs || 10000)
        ]);

        if (!mainResp.ok) {
            if (mainResp.status === 404) {
                throw new Error(NONE_EXIST_ERROR);
            }
            throw new Error(`IMDb request failed: ${mainResp.status} ${mainResp.statusText}`);
        }

        const mainHtml = await mainResp.text();
        if (mainHtml.includes('404 Error - IMDb')) {
            throw new Error(NONE_EXIST_ERROR);
        }

        // Parse Main Page
        const $ = cheerio.load(mainHtml);
        const jsonLdScript = $('script[type="application/ld+json"]').html();
        if (!jsonLdScript) {
            throw new Error("IMDb page parse failed: JSON-LD script not found");
        }

        let jsonLd: any;
        try {
            jsonLd = JSON.parse(jsonLdScript.replace(/\n/ig, ''));
        } catch (e) {
            throw new Error("IMDb page parse failed: JSON-LD parse error");
        }

        // Parse Next Data
        let nextData: any = {};
        const nextDataRaw = $('script#__NEXT_DATA__').html();
        if (nextDataRaw) {
            try {
                nextData = JSON.parse(nextDataRaw.replace(/\n/ig, ''));
            } catch { }
        }

        // Parse Details Section
        const detailsDict: { [key: string]: string[] } = {};
        const detailsSection = $("section[cel_widget_id='StaticFeature_Details']");
        const detailItems = detailsSection.find("li.ipc-metadata-list__item");
        detailItems.each((_, el) => {
            const label = $(el).find(".ipc-metadata-list-item__label").text();
            const values: string[] = [];
            $(el).find(".ipc-metadata-list-item__list-content-item").each((__, valEl) => {
                const val = $(valEl);
                if (val.attr("href") && val.attr("href")?.startsWith("http")) {
                    values.push(`${val.text()} - ${val.attr("href")}`);
                } else {
                    values.push(val.text());
                }
            });
            if (values.length > 0) detailsDict[label] = values;
        });

        // Parse Release Info Page
        const releaseDate: { country: string, date: string }[] = [];
        const aka: { country: string, title: string }[] = [];

        if (releaseResp.ok) {
            const releaseHtml = await releaseResp.text();
            const $release = cheerio.load(releaseHtml);

            $release("tr.release-date-item").each((_, el) => {
                const country = $release(el).find("td.release-date-item__country-name").text().trim();
                const date = $release(el).find("td.release-date-item__date").text().trim();
                if (country && date) releaseDate.push({ country, date });
            });

            $release("tr.aka-item").each((_, el) => {
                const country = $release(el).find("td.aka-item__name").text().trim();
                const title = $release(el).find("td.aka-item__title").text().trim();
                if (country && title) aka.push({ country, title });
            });
        }

        return {
            site: 'imdb',
            success: true,
            imdb_id: imdbId,
            json_ld: jsonLd,
            next_data: nextData,
            details: detailsDict,
            release_date: releaseDate,
            aka: aka
        };
    }

    async search(query: string, config: AppConfig): Promise<SearchResult[]> {
        const q = query.toLowerCase();
        const url = `https://v2.sg.media-imdb.com/suggestion/${encodeURIComponent(q.slice(0, 1))}/${encodeURIComponent(q)}.json`;

        const response = await fetchWithTimeout(url);
        if (!response.ok) {
            throw new Error(`IMDb search request failed: ${response.status}`);
        }

        const json = await response.json();
        return (json.d || []).filter((d: any) => d.id && d.id.startsWith('tt'))
            .map((d: any) => ({
                provider: 'imdb',
                id: d.id,
                title: d.l,
                year: d.y ? String(d.y) : '',
                type: d.q,
                link: `https://www.imdb.com/title/${d.id}`,
                poster: d.i ? d.i.imageUrl : undefined // 'i' object has imageUrl? Need to verify structure or legacy usage. 
                // Legacy code didn't map poster in search results explicitly, just year, subtype, title, link.
                // But SearchResult schema has poster.
            }));
    }
}
