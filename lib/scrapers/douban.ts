import { Scraper } from '../interfaces/scraper';
import { AppConfig } from '../types/config';
import { DoubanRawData, RawData } from '../types/raw-data';
import { SearchResult } from '../types/schema';
import { normalizeCookie, mergeCookies } from '../utils/string';
import { fetchWithTimeout } from '../utils/fetch';
import { rateLimiter } from '../utils/rate-limiter';
import { pageParser } from '../utils/html';
import { NONE_EXIST_ERROR } from '../utils/error';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_WARMUP_TIMEOUT_MS = 4_000;
const HAS_GETSETCOOKIE =
    typeof Headers !== 'undefined' &&
    typeof Headers.prototype?.getSetCookie === 'function';

export class DoubanScraper implements Scraper {
    async fetch(id: string, config: AppConfig): Promise<DoubanRawData> {
        const timeoutMs =
            config.doubanTimeoutMs ??
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        const baseHeaders = this.buildHeaders(config);
        const cfgCookie = normalizeCookie(config.doubanCookie);
        const bid = /(?:^|;\s*)bid=/.test(cfgCookie)
            ? ''
            : await this.warmupBidCookie(config, baseHeaders);
        const cookieHeader = mergeCookies(cfgCookie, bid);
        const headers = cookieHeader
            ? { ...baseHeaders, Cookie: cookieHeader }
            : baseHeaders;

        const doubanLink = `https://movie.douban.com/subject/${id}/`;
        const { html, blocked, status } = await this.fetchSubjectHtml(
            id,
            headers,
            timeoutMs,
            config
        );

        if (blocked) {
            return {
                site: 'douban',
                sid: id,
                success: false,
                error:
                    'Blocked by Douban anti-bot (sec.douban.com). Try setting DOUBAN_COOKIE or switching to Cloudflare Workers/Bun runtime.',
            };
        }

        if (!html) {
            return {
                site: 'douban',
                sid: id,
                success: false,
                error:
                    status === 404
                        ? NONE_EXIST_ERROR
                        : 'Failed to fetch Douban page (network error/timeout). If you are self-hosting in a restricted network, consider setting DOUBAN_COOKIE.',
            };
        }

        const data: DoubanRawData = {
            site: 'douban',
            sid: id,
            success: true,
            html: html,
            douban_link: doubanLink,
        };

        // Awards and IMDb are enriched in Normalizer or here? 
        // Usually scraper just gets raw data. 
        // In the legacy code, gen_douban does fetching awards/imdb. 
        // To keep it clean, Scraper should fetch everything possible and return it in RawData.

        try {
            const awardsHtml = await this.fetchAwards(id, config, headers, timeoutMs);
            if (awardsHtml) {
                data.awards_html = awardsHtml;
            }
        } catch {
            // ignore
        }

        // Checking IMDb ID from HTML to fetch IMDb rating is a bit tricky because we need to parse HTML first.
        // Ideally Scraper returns HTML, Normalizer parses it. 
        // But if we need IMDb data *during* scraping, we need to parse specific bits.
        // Let's parse IMDb ID here quickly or verify if we can do 2-step.
        // For now, let's keep it simple: Scraper only fetches the main page. 
        // If we need secondary fetches based on content, we might need a "Smart Scraper" or let Normalizer request more?
        // Actually, `gen_douban` logic does parse to get `imdb_id` then fetches `imdb`.
        // We can do a quick regex extract of IMDb ID here to support that feature.

        // Quick extract IMDb ID
        const $ = pageParser(html);
        const imdbAnchor = $('#info span.pl:contains("IMDb")');
        const imdbText = (imdbAnchor?.[0]?.nextSibling as any)?.data; // basic check
        if (imdbText) {
            const imdbId = String(imdbText).trim();
            data.imdb_id = imdbId;
            const imdbData = await this.fetchImdbRating(imdbId, config, timeoutMs);
            if (imdbData) {
                data.imdb_data = imdbData;
            }
        }

        return data;
    }

    async search(query: string, config: AppConfig): Promise<SearchResult[]> {
        const timeoutMs =
            config.doubanTimeoutMs ??
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        const baseHeaders = this.buildHeaders(config);
        const cfgCookie = normalizeCookie(config.doubanCookie);
        const bid = /(?:^|;\s*)bid=/.test(cfgCookie)
            ? ''
            : await this.warmupBidCookie(config, baseHeaders);
        const cookieHeader = mergeCookies(cfgCookie, bid);
        const headers = cookieHeader
            ? { ...baseHeaders, Cookie: cookieHeader }
            : baseHeaders;

        await rateLimiter.acquire('douban', 3000);

        const resp = await fetchWithTimeout(
            `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(
                query
            )}`,
            { headers },
            timeoutMs,
            config
        );

        if (!resp.ok) {
            // Douban search endpoint can be blocked or rate-limited.
            const body = await resp.text().catch(() => '');
            if (this.looksLikeSecChallenge(resp, body)) {
                throw new Error('Blocked by Douban anti-bot (sec.douban.com).');
            }
            throw new Error(`Douban search failed: ${resp.status} ${resp.statusText}`);
        }

        const json = await resp.json();

        return (json as any[]).map((d) => ({
            provider: 'douban',
            id: d.id,
            title: d.title,
            subtitle: d.sub_title,
            year: d.year,
            type: d.type,
            link: `https://movie.douban.com/subject/${d.id}/`,
            poster: d.img,
        }));
    }

    private buildHeaders(config: AppConfig): Record<string, string> {
        const headers: Record<string, string> = {
            'User-Agent':
                config.doubanUserAgent ||
                'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language':
                config.doubanAcceptLanguage || 'zh-CN,zh;q=0.9,en;q=0.8',
            Referer: 'https://movie.douban.com/',
        };

        const cookie = normalizeCookie(config.doubanCookie);
        if (cookie) headers['Cookie'] = cookie;

        return headers;
    }

    private async warmupBidCookie(
        config: AppConfig,
        baseHeaders: Record<string, string>
    ): Promise<string> {
        try {
            await rateLimiter.acquire('douban', 2000);
            const timeoutMs =
                config.doubanWarmupTimeoutMs ||
                Math.min(
                    config.doubanTimeoutMs ??
                    config.timeout ??
                    DEFAULT_TIMEOUT_MS,
                    DEFAULT_WARMUP_TIMEOUT_MS
                );

            const resp = await fetchWithTimeout(
                'https://movie.douban.com/',
                { headers: baseHeaders, redirect: 'manual' },
                timeoutMs,
                config
            );
            return this.extractBidCookieFromResponse(resp);
        } catch {
            return '';
        }
    }

    private extractBidCookieFromResponse(resp: Response): string {
        const headers = resp.headers;
        let setCookies: string[] = [];
        if (HAS_GETSETCOOKIE && headers) {
            // @ts-ignore
            setCookies = headers.getSetCookie();
        } else {
            const single = headers?.get('set-cookie');
            if (single) setCookies = [single];
        }

        for (const raw of setCookies) {
            const m = String(raw).match(/(?:^|;\s*)bid=([^;]+)/);
            if (m) return `bid=${m[1]}`;
        }
        return '';
    }

    private async fetchSubjectHtml(
        sid: string,
        headers: Record<string, string>,
        timeoutMs: number,
        config: AppConfig
    ): Promise<{ html: string; blocked: boolean; url: string; status?: number }> {
        const candidateUrls = [
            `https://movie.douban.com/subject/${sid}/`,
            `https://m.douban.com/movie/subject/${sid}/`,
        ];

        let blocked = false;
        let lastStatus: number | undefined;

        for (const url of candidateUrls) {
            try {
                await rateLimiter.acquire('douban', 3000);
                const resp = await fetchWithTimeout(url, { headers }, timeoutMs, config);
                const text = await resp.text();

                if (this.looksLikeSecChallenge(resp, text)) {
                    blocked = true;
                    continue;
                }

                if (resp.ok) {
                    return { html: text, blocked: false, url, status: resp.status };
                }

                lastStatus = resp.status;
            } catch {
                continue;
            }
        }

        return {
            html: '',
            blocked,
            url: candidateUrls[candidateUrls.length - 1],
            status: lastStatus,
        };
    }

    private looksLikeSecChallenge(resp: Response | null, bodyText: string): boolean {
        const finalUrl = resp?.url || '';
        if (finalUrl.includes('sec.douban.com')) return true;
        if (/sec\.douban\.com/.test(bodyText || '')) return true;
        if (/检测到有异常请求|异常请求/.test(bodyText || '')) return true;
        if (/请开启JavaScript|captcha|验证码/.test(bodyText || '')) return true;
        return false;
    }

    private async fetchAwards(
        sid: string,
        config: AppConfig,
        headers: Record<string, string>,
        timeoutMs: number
    ): Promise<string | null> {
        if (config.doubanIncludeAwards === false) return null;

        await rateLimiter.acquire('douban', 2000);
        const resp = await fetchWithTimeout(`https://movie.douban.com/subject/${sid}/awards`, { headers }, timeoutMs, config);
        if (!resp.ok) return null;

        const raw = await resp.text();
        if (this.looksLikeSecChallenge(resp, raw)) return null;

        // Just return raw html, let Normalizer parse it
        return raw;
    }

    private async fetchImdbRating(imdbId: string, config: AppConfig, timeoutMs: number): Promise<any> {
        if (config.doubanIncludeImdb === false) return null;

        // Usually jsonp, but we can just fetch and parse
        const resp = await fetchWithTimeout(
            `https://p.media-imdb.com/static-content/documents/v1/title/${imdbId}/ratings%3Fjsonp=imdb.rating.run:imdb.api.title.ratings/data.json`,
            {},
            timeoutMs,
            config
        );
        if (!resp.ok) return null;
        const raw = await resp.text();
        // Simple jsonp parse
        try {
            const text = raw.replace(/\n/ig, '').match(/[^(]+\((.+)\)/)?.[1];
            if (!text) return null;
            return JSON.parse(text);
        } catch {
            return null;
        }
    }
}
