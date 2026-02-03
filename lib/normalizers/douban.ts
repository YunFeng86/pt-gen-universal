import { Normalizer } from '../interfaces/normalizer';
import { AppConfig } from '../types/config';
import { DoubanRawData, RawData } from '../types/raw-data';
import { MediaInfo } from '../types/schema';
import { pageParser } from '../utils/html';
import { safeJsonParse } from '../utils/json';
import { ensureArray } from '../utils/array';
import {
    normalizeMaybeArray,
    normalizePeople,
    fetchAnchorText,
} from '../utils/string';
import { sortPlaydates } from '../utils/date';

const DOUBAN_GENRES = new Set([
    '剧情', '喜剧', '动作', '爱情', '科幻', '动画', '悬疑', '惊悚', '恐怖', '犯罪',
    '同性', '音乐', '歌舞', '传记', '历史', '战争', '西部', '奇幻', '冒险', '灾难',
    '武侠', '情色', '纪录片', '短片', '家庭', '儿童', '古装', '戏曲', '黑色电影', '运动',
]);

export class DoubanNormalizer implements Normalizer {
    normalize(rawData: RawData, config: AppConfig): MediaInfo {
        if (rawData.site !== 'douban') {
            throw new Error(`DoubanNormalizer cannot handle site: ${rawData.site}`);
        }
        const data = rawData as DoubanRawData;
        if (!data.html) {
            throw new Error('DoubanRawData missing html content');
        }

        const info = this.parseSubjectHtml(data.html, data.sid, data.douban_link || '');

        // Enrich with extra data if available in RawData
        if (data.awards_html) {
            info.awards = this.parseAwards(data.awards_html);
        }

        if (data.imdb_data) {
            const imdb = data.imdb_data?.resource;
            if (imdb && imdb.rating && imdb.ratingCount) {
                const imdbId = info.imdb_id;
                if (!info.imdb_link && imdbId) {
                    info.imdb_link = `https://www.imdb.com/title/${imdbId}/`;
                }

                info.imdb_rating_average = imdb.rating;
                info.imdb_votes = imdb.ratingCount;
                info.imdb_rating = `${imdb.rating}/10 from ${imdb.ratingCount} users`;

                info.ratings = info.ratings || {};
                info.ratings.imdb = {
                    average: imdb.rating,
                    votes: imdb.ratingCount,
                    formatted: `${imdb.rating}/10 from ${imdb.ratingCount} users`,
                    link: info.imdb_link || ''
                };
            }
        }

        return info;
    }

    private parseSubjectHtml(html: string, sid: string, link: string): MediaInfo {
        const $ = pageParser(html);

        // Check if mobile or desktop based on structure
        // m.douban.com pages often do not ship JSON-LD; they are still parseable.
        if ($('.subject-header-wrap').length > 0 || $('.sub-title').length > 0) {
            return this.parseMobileSubjectHtml($, sid, link);
        }

        // Desktop
        const title = $('title').text().replace('(豆瓣)', '').trim();
        const ldJson = safeJsonParse(
            $('head > script[type="application/ld+json"]').first().html() ||
            $('script[type="application/ld+json"]').first().html()
        );

        const info: MediaInfo = {
            site: 'douban',
            id: sid,
            link: link,
            chinese_title: '',
            foreign_title: '',
            aka: [],
            trans_title: [],
            this_title: [],
            year: '',
            playdate: [],
            region: [],
            genre: [],
            language: [],
            duration: '',
            episodes: '',
            seasons: '',
            poster: '',
            director: [],
            writer: [],
            cast: [],
            introduction: '',
            awards: '',
            tags: [],
            douban_link: link,
        };

        if (!ldJson) {
            // Fallback or error? Legacy code returned error.
            // For robustness, we might want to throw or return partial.
            // Legacy: "Douban page parse failed (JSON-LD not found)"
            // Let's assume desktop pages always have JSON-LD or we fail.
            // Actually, let's try to scrape what we can if JSON-LD is missing, 
            // but for now stick to legacy logic which relies heavily on it.
            throw new Error('Douban page parse failed (JSON-LD not found)');
        }

        // IMDb
        const imdbAnchor = $('#info span.pl:contains("IMDb")');
        if (imdbAnchor.length > 0) {
            const imdbId = fetchAnchorText(imdbAnchor);
            if (imdbId) {
                info.imdb_id = imdbId;
                info.imdb_link = `https://www.imdb.com/title/${imdbId}/`;
            }
        }

        const chineseTitle = title;
        const foreignTitle = $('span[property="v:itemreviewed"]')
            .text()
            .replace(chineseTitle, '')
            .trim();

        const akaAnchor = $('#info span.pl:contains("又名")');
        const akaRaw = fetchAnchorText(akaAnchor);
        const aka = akaRaw ? akaRaw.split(' / ').map((x) => x.trim()).filter(Boolean).sort() : [];

        this.setTitles(info, { chinese_title: chineseTitle, foreign_title: foreignTitle, aka: aka.join('/') });

        const yearRaw = $('#content > h1 > span.year').text();
        info.year = yearRaw ? ' ' + yearRaw.substr(1, 4) : '';

        const regionsAnchor = $('#info span.pl:contains("制片国家/地区")');
        const regionRaw = regionsAnchor[0] ? fetchAnchorText(regionsAnchor) : '';
        info.region = regionRaw ? regionRaw.split(' / ') : [];

        info.genre = $('#info span[property="v:genre"]')
            .map((_, el) => $(el).text().trim())
            .toArray() as string[];

        const languageAnchor = $('#info span.pl:contains("语言")');
        const languageRaw = languageAnchor[0] ? fetchAnchorText(languageAnchor) : '';
        info.language = languageRaw ? languageRaw.split(' / ') : [];

        info.playdate = sortPlaydates(
            $('#info span[property="v:initialReleaseDate"]')
                .map((_, el) => $(el).text().trim())
                .toArray() as string[]
        );

        const episodesAnchor = $('#info span.pl:contains("集数")');
        info.episodes = episodesAnchor[0] ? fetchAnchorText(episodesAnchor) : '';

        const durationAnchor = $('#info span.pl:contains("单集片长")');
        info.duration = durationAnchor[0]
            ? fetchAnchorText(durationAnchor)
            : $('#info span[property="v:runtime"]').text().trim();

        const introNode = $(
            '#link-report-intra > span.all.hidden, #link-report-intra > [property="v:summary"], #link-report > span.all.hidden, #link-report > [property="v:summary"]'
        );
        info.introduction = (introNode.length > 0 ? introNode.text() : '暂无相关剧情介绍')
            .split('\n')
            .map((a) => a.trim())
            .filter((a) => a.length > 0)
            .join('\n');

        const doubanRating = ldJson['aggregateRating']?.['ratingValue'] || 0;
        const doubanVotes = ldJson['aggregateRating']?.['ratingCount'] || 0;
        info.douban_rating_average = Number(doubanRating) || 0;
        info.douban_votes = Number(doubanVotes) || 0;
        if (info.douban_rating_average && info.douban_votes) {
            info.douban_rating = `${info.douban_rating_average}/10 from ${info.douban_votes} users`;
            info.ratings = {
                douban: {
                    average: info.douban_rating_average,
                    votes: info.douban_votes,
                    formatted: info.douban_rating,
                    link: link
                }
            };
        }

        if (ldJson['image']) {
            info.poster = String(ldJson['image'])
                .replace(/s(_ratio_poster|pic)/g, 'l$1')
                .replace('img3', 'img1');
        }

        info.director = ensureArray(ldJson['director']).map((x: any) => x.name || x);
        info.writer = ensureArray(ldJson['author']).map((x: any) => x.name || x);
        info.cast = ensureArray(ldJson['actor']).map((x: any) => x.name || x);

        const tagNodes = $('div.tags-body > a[href^="/tag"]');
        if (tagNodes.length > 0) {
            info.tags = tagNodes.map((_, el) => $(el).text()).get() as string[];
        }

        return info;
    }

    private parseMobileSubjectHtml($: any, sid: string, link: string): MediaInfo {
        const info: MediaInfo = {
            site: 'douban',
            id: sid,
            link: link,
            chinese_title: '',
            foreign_title: '',
            aka: [],
            trans_title: [],
            this_title: [],
            year: '',
            playdate: [],
            region: [],
            genre: [],
            language: [],
            duration: '',
            episodes: '',
            seasons: '',
            poster: '',
            director: [],
            writer: [],
            cast: [],
            introduction: '',
            awards: '',
            tags: [],
            douban_link: link,
        };

        const chineseTitle = $('.sub-title').first().text().trim() || $('title').text().trim();
        const original = $('.sub-original-title').first().text().trim();
        const yearMatch = original.match(/(\d{4})/);
        const yearOnly = yearMatch ? yearMatch[1] : '';
        info.year = yearOnly ? ` ${yearOnly}` : '';

        const foreignTitle = original
            ? original.replace(/[（(]\s*\d{4}.*?[）)]\s*$/, '').trim()
            : '';

        this.setTitles(info, { chinese_title: chineseTitle, foreign_title: foreignTitle });

        const poster = $('.sub-cover img').attr('src') || '';
        if (poster) {
            info.poster = String(poster)
                .replace(/s(_ratio_poster|pic)/g, 'l$1')
                .replace('img3', 'img1');
        }

        const ratingValue = Number($('meta[itemprop="ratingValue"]').attr('content')) || 0;
        const reviewCount = Number($('meta[itemprop="reviewCount"]').attr('content')) || 0;

        info.douban_rating_average = ratingValue || 0;
        info.douban_votes = reviewCount || 0;
        if (info.douban_rating_average && info.douban_votes) {
            info.douban_rating = `${info.douban_rating_average}/10 from ${info.douban_votes} users`;
            info.ratings = {
                douban: {
                    average: info.douban_rating_average,
                    votes: info.douban_votes,
                    formatted: info.douban_rating,
                    link: link
                }
            };
        }

        const meta = $('.sub-meta').first().text().replace(/\s+/g, ' ').trim();
        const parts = meta ? meta.split(' / ').map((s: string) => s.trim()).filter(Boolean) : [];

        for (const p of parts) {
            if (p.includes('上映')) {
                info.playdate.push(p.replace(/上映/g, '').trim());
                continue;
            }
            if (p.startsWith('片长')) {
                info.duration = p.replace(/^片长/, '').trim();
                continue;
            }
            if (DOUBAN_GENRES.has(p)) {
                info.genre.push(p);
                continue;
            }
            info.region.push(p);
        }

        info.playdate = sortPlaydates(info.playdate);

        const introP = $('section.subject-intro .bd p').first();
        if (introP.length > 0) {
            const html = introP.html() || '';
            info.introduction = html
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .split('\n')
                .map((a: string) => a.trim())
                .filter((a: string) => a.length > 0)
                .join('\n');
        } else {
            info.introduction = '暂无相关剧情介绍';
        }

        return info;
    }

    private setTitles(data: MediaInfo, { chinese_title, foreign_title, aka }: any) {
        const chineseTitle = String(chinese_title || '').trim();
        const foreignTitle = String(foreign_title || '').trim();

        data.chinese_title = chineseTitle;
        data.foreign_title = foreignTitle;

        const akaStr = String(aka || '').trim();
        if (akaStr) data.aka = akaStr.split('/');

        let trans_title;
        let this_title;
        if (foreignTitle) {
            trans_title = chineseTitle + (akaStr ? '/' + akaStr : '');
            this_title = foreignTitle;
        } else {
            trans_title = akaStr ? akaStr : '';
            this_title = chineseTitle;
        }

        data.trans_title = String(trans_title).split('/');
        data.this_title = String(this_title).split('/');
    }

    private parseAwards(html: string): string {
        const $ = pageParser(html);
        const awardsHtml = $('#content > div > div.article').html() || '';
        if (!awardsHtml) return '';

        return awardsHtml
            .replace(/[ \n]/g, '')
            .replace(/<\/li><li>/g, '</li> <li>')
            .replace(/<\/a><span/g, '</a> <span')
            .replace(/<(div|ul)[^>]*>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/ +\n/g, '\n')
            .trim();
    }
}
