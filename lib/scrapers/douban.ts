import { Scraper } from '../interfaces/scraper';
import { AppConfig } from '../types/config';
import { DoubanRawData, RawData } from '../types/raw-data';
import { SearchResult } from '../types/schema';
import { normalizeCookie, mergeCookies } from '../utils/string';
import { fetchWithTimeout } from '../utils/fetch';
import { rateLimiter } from '../utils/rate-limiter';
import { pageParser } from '../utils/html';
import { safeJsonParse } from '../utils/json';
import { NONE_EXIST_ERROR } from '../utils/error';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_WARMUP_TIMEOUT_MS = 4_000;
const HAS_GETSETCOOKIE =
  typeof Headers !== 'undefined' && typeof Headers.prototype?.getSetCookie === 'function';

export class DoubanScraper implements Scraper {
  async fetch(id: string, config: AppConfig): Promise<DoubanRawData> {
    const timeoutMs = config.doubanTimeoutMs ?? config.timeout ?? DEFAULT_TIMEOUT_MS;
    const baseHeaders = this.buildHeaders(config);
    const cfgCookie = normalizeCookie(config.doubanCookie);
    const warmup = /(?:^|;\s*)bid=/.test(cfgCookie)
      ? { cookie: '', proxyUsed: false }
      : await this.warmupBidCookie(config, baseHeaders);
    let proxy_used = warmup.proxyUsed;
    const bid = warmup.cookie;
    const cookieHeader = mergeCookies(cfgCookie, bid);
    const headers = cookieHeader ? { ...baseHeaders, Cookie: cookieHeader } : baseHeaders;

    const doubanLink = `https://movie.douban.com/subject/${id}/`;
    const {
      html,
      blocked,
      status,
      proxyUsed: subjectProxyUsed,
    } = await this.fetchSubjectHtml(id, headers, timeoutMs, config);
    proxy_used = proxy_used || subjectProxyUsed;

    if (blocked) {
      return {
        site: 'douban',
        sid: id,
        success: false,
        proxy_used,
        error:
          'Blocked by Douban anti-bot (sec.douban.com). Try setting DOUBAN_COOKIE or switching to Cloudflare Workers/Bun runtime.',
      };
    }

    if (!html) {
      return {
        site: 'douban',
        sid: id,
        success: false,
        proxy_used,
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
      proxy_used,
      html: html,
      douban_link: doubanLink,
    };

    // The mobile page renders the crew list via JS, so enrich with the rexxar API.
    // Directors / writers / actors / languages / episodes may be missing from raw HTML.
    try {
      const rexxar = await this.fetchRexxarApi(id, config, headers, timeoutMs);
      proxy_used = proxy_used || rexxar.proxyUsed;
      data.proxy_used = proxy_used;
      if (rexxar.data) {
        data.rexxar_data = rexxar.data;
      }
    } catch {
      // ignore
    }

    // Awards and IMDb are enriched in Normalizer or here?
    // Usually scraper just gets raw data.
    // In the legacy code, gen_douban does fetching awards/imdb.
    // To keep it clean, Scraper should fetch everything possible and return it in RawData.

    try {
      const awards = await this.fetchAwards(id, config, headers, timeoutMs);
      proxy_used = proxy_used || awards.proxyUsed;
      data.proxy_used = proxy_used;
      if (awards.html) {
        data.awards_html = awards.html;
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
      const imdb = await this.fetchImdbRating(imdbId, config, timeoutMs);
      proxy_used = proxy_used || imdb.proxyUsed;
      data.proxy_used = proxy_used;
      if (imdb.data) {
        data.imdb_data = imdb.data;
      }
    }

    return data;
  }

  async search(query: string, config: AppConfig): Promise<SearchResult[]> {
    const timeoutMs = config.doubanTimeoutMs ?? config.timeout ?? DEFAULT_TIMEOUT_MS;
    const baseHeaders = this.buildHeaders(config);
    const cfgCookie = normalizeCookie(config.doubanCookie);
    const warmup = /(?:^|;\s*)bid=/.test(cfgCookie)
      ? { cookie: '', proxyUsed: false }
      : await this.warmupBidCookie(config, baseHeaders);
    const bid = warmup.cookie;
    const cookieHeader = mergeCookies(cfgCookie, bid);
    const headers = cookieHeader ? { ...baseHeaders, Cookie: cookieHeader } : baseHeaders;

    await rateLimiter.acquire('douban', 3000);

    const result = await fetchWithTimeout(
      `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(query)}`,
      { headers },
      timeoutMs,
      config
    );
    const resp = result.response;

    if (!resp.ok) {
      // Douban search endpoint can be blocked or rate-limited.
      const body = await resp.text().catch(() => '');
      if (this.looksLikeSecChallenge(resp, body)) {
        const e: any = new Error('Blocked by Douban anti-bot (sec.douban.com).');
        e.proxy_used = result.proxyUsed || warmup.proxyUsed;
        throw e;
      }
      const e: any = new Error(`Douban search failed: ${resp.status} ${resp.statusText}`);
      e.proxy_used = result.proxyUsed || warmup.proxyUsed;
      throw e;
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
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': config.doubanAcceptLanguage || 'zh-CN,zh;q=0.9,en;q=0.8',
      Referer: 'https://movie.douban.com/',
    };

    const cookie = normalizeCookie(config.doubanCookie);
    if (cookie) headers['Cookie'] = cookie;

    return headers;
  }

  private async warmupBidCookie(
    config: AppConfig,
    baseHeaders: Record<string, string>
  ): Promise<{ cookie: string; proxyUsed: boolean }> {
    try {
      await rateLimiter.acquire('douban', 2000);
      const timeoutMs =
        config.doubanWarmupTimeoutMs ||
        Math.min(
          config.doubanTimeoutMs ?? config.timeout ?? DEFAULT_TIMEOUT_MS,
          DEFAULT_WARMUP_TIMEOUT_MS
        );

      const { response: resp, proxyUsed } = await fetchWithTimeout(
        'https://movie.douban.com/',
        { headers: baseHeaders, redirect: 'manual' },
        timeoutMs,
        config
      );
      return { cookie: this.extractBidCookieFromResponse(resp), proxyUsed };
    } catch {
      return { cookie: '', proxyUsed: false };
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
  ): Promise<{ html: string; blocked: boolean; url: string; status?: number; proxyUsed: boolean }> {
    const candidateUrls = [
      `https://movie.douban.com/subject/${sid}/`,
      `https://m.douban.com/movie/subject/${sid}/`,
    ];

    let blocked = false;
    let lastStatus: number | undefined;
    let proxyUsed = false;

    for (const url of candidateUrls) {
      try {
        await rateLimiter.acquire('douban', 3000);
        const result = await fetchWithTimeout(url, { headers }, timeoutMs, config);
        proxyUsed = proxyUsed || result.proxyUsed;
        const resp = result.response;
        const text = await resp.text();

        if (this.looksLikeSecChallenge(resp, text)) {
          blocked = true;
          continue;
        }

        if (resp.ok) {
          return { html: text, blocked: false, url, status: resp.status, proxyUsed };
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
      proxyUsed,
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

  private async fetchRexxarApi(
    sid: string,
    config: AppConfig,
    headers: Record<string, string>,
    timeoutMs: number
  ): Promise<{ data: any | null; proxyUsed: boolean }> {
    if (config.doubanIncludeRexxar === false) return { data: null, proxyUsed: false };

    const endpoints = [
      `https://m.douban.com/rexxar/api/v2/movie/${sid}?ck=&for_mobile=1`,
      `https://m.douban.com/rexxar/api/v2/tv/${sid}?ck=&for_mobile=1`,
    ];

    for (const url of endpoints) {
      try {
        await rateLimiter.acquire('douban', 2000);
        const apiHeaders = {
          ...headers,
          Accept: 'application/json, text/plain, */*',
          Referer: `https://m.douban.com/movie/subject/${sid}/`,
        };
        const { response: resp, proxyUsed } = await fetchWithTimeout(
          url,
          { headers: apiHeaders },
          timeoutMs,
          config
        );
        if (!resp.ok) continue;
        const raw = await resp.text();
        if (this.looksLikeSecChallenge(resp, raw)) continue;
        const json = safeJsonParse(raw);
        if (json) return { data: json, proxyUsed };
      } catch {
        continue;
      }
    }

    return { data: null, proxyUsed: false };
  }

  private async fetchAwards(
    sid: string,
    config: AppConfig,
    headers: Record<string, string>,
    timeoutMs: number
  ): Promise<{ html: string | null; proxyUsed: boolean }> {
    if (config.doubanIncludeAwards === false) return { html: null, proxyUsed: false };

    await rateLimiter.acquire('douban', 2000);
    const { response: resp, proxyUsed } = await fetchWithTimeout(
      `https://movie.douban.com/subject/${sid}/awards`,
      { headers },
      timeoutMs,
      config
    );
    if (!resp.ok) return { html: null, proxyUsed };

    const raw = await resp.text();
    if (this.looksLikeSecChallenge(resp, raw)) return { html: null, proxyUsed };

    // Just return raw html, let Normalizer parse it
    return { html: raw, proxyUsed };
  }

  private async fetchImdbRating(
    imdbId: string,
    config: AppConfig,
    timeoutMs: number
  ): Promise<{ data: any | null; proxyUsed: boolean }> {
    if (config.doubanIncludeImdb === false) return { data: null, proxyUsed: false };

    // Usually jsonp, but we can just fetch and parse
    const { response: resp, proxyUsed } = await fetchWithTimeout(
      `https://p.media-imdb.com/static-content/documents/v1/title/${imdbId}/ratings%3Fjsonp=imdb.rating.run:imdb.api.title.ratings/data.json`,
      {},
      timeoutMs,
      config
    );
    if (!resp.ok) return { data: null, proxyUsed };
    const raw = await resp.text();
    // Simple jsonp parse
    try {
      const text = raw.replace(/\n/gi, '').match(/[^(]+\((.+)\)/)?.[1];
      if (!text) return { data: null, proxyUsed };
      return { data: JSON.parse(text), proxyUsed };
    } catch {
      return { data: null, proxyUsed };
    }
  }
}
