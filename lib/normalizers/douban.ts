import { Normalizer } from '../interfaces/normalizer';
import { AppConfig } from '../types/config';
import { DoubanRawData, RawData } from '../types/raw-data';
import { MediaInfo } from '../types/schema';
import { pageParser } from '../utils/html';
import { safeJsonParse } from '../utils/json';
import { ensureArray } from '../utils/array';
import { sortPlaydates } from '../utils/date';

const DOUBAN_GENRES = new Set([
  '剧情',
  '喜剧',
  '动作',
  '爱情',
  '科幻',
  '动画',
  '悬疑',
  '惊悚',
  '恐怖',
  '犯罪',
  '同性',
  '音乐',
  '歌舞',
  '传记',
  '历史',
  '战争',
  '西部',
  '奇幻',
  '冒险',
  '灾难',
  '武侠',
  '情色',
  '纪录片',
  '短片',
  '家庭',
  '儿童',
  '古装',
  '戏曲',
  '黑色电影',
  '运动',
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

    const info = this.parseSubjectHtml(
      data.html,
      data.sid,
      data.douban_link || '',
      data.rexxar_data
    );

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
          link: info.imdb_link || '',
        };
      }
    }

    return info;
  }

  private parseSubjectHtml(html: string, sid: string, link: string, rexxarData?: any): MediaInfo {
    const $ = pageParser(html);

    // Check if mobile or desktop based on structure
    // m.douban.com pages often do not ship JSON-LD; they are still parseable.
    if ($('.subject-header-wrap').length > 0 || $('.sub-title').length > 0) {
      return this.parseMobileSubjectHtml($, sid, link, rexxarData);
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
      const infoRows = this.parseInfoRows($);
      this.applyInfoRows(info, infoRows, $, title);
      this.applyIntroAndTags(info, $);
      return info;
    }

    const infoRows = this.parseInfoRows($);

    this.applyInfoRows(info, infoRows, $, title);

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
          link: link,
        },
      };
    }

    if (ldJson['image']) {
      info.poster = String(ldJson['image'])
        .replace(/s(_ratio_poster|pic)/g, 'l$1')
        .replace('img3', 'img1');
    }

    const ldDirector = ensureArray(ldJson['director']).map((x: any) => x.name || x);
    const ldWriter = ensureArray(ldJson['author']).map((x: any) => x.name || x);
    const ldCast = ensureArray(ldJson['actor']).map((x: any) => x.name || x);

    info.director = this.rowLinks(infoRows, '导演', ldDirector);
    info.writer = this.rowLinks(infoRows, '编剧', ldWriter);
    info.cast = this.rowLinks(infoRows, '主演', ldCast);

    this.applyIntroAndTags(info, $);

    return info;
  }

  private rowLinks(
    rows: Record<string, { links: string[]; text: string }>,
    label: string,
    fallback: string[]
  ): string[] {
    const row = rows[label];
    if (!row) return fallback;
    if (row.links.length) return row.links;
    if (row.text) {
      return row.text
        .split(' / ')
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return fallback;
  }

  private parseInfoRows(
    $: ReturnType<typeof pageParser>
  ): Record<string, { links: string[]; text: string }> {
    const rows: Record<string, { links: string[]; text: string }> = {};

    const infoHtml = $('#info').html() || '';
    const lines = infoHtml.split(/<br\s*\/?>/i);

    for (const line of lines) {
      if (!line.trim()) continue;
      const $line = $('<div></div>').html(line);
      const $pl = $line.find('span.pl').first();
      if (!$pl.length) continue;
      const label = $pl
        .text()
        .replace(/[:：]\s*$/, '')
        .trim();
      if (!label) continue;

      const links = $line
        .find('a')
        .map((_, a: any) => $(a).text().trim())
        .get()
        .filter(Boolean);

      if (links.length) {
        rows[label] = { links, text: '' };
        continue;
      }

      const rawText = $line.text().replace($pl.text(), '').trim();
      rows[label] = { links: [], text: rawText.replace(/^[:：]\s*/, '') };
    }

    return rows;
  }

  private applyInfoRows(
    info: MediaInfo,
    rows: Record<string, { links: string[]; text: string }>,
    $: ReturnType<typeof pageParser>,
    title: string
  ): void {
    // IMDb
    const imdbRow = rows['IMDb'];
    const imdbId = imdbRow?.links[0] || imdbRow?.text || '';
    if (imdbId) {
      info.imdb_id = imdbId;
      info.imdb_link = `https://www.imdb.com/title/${imdbId}/`;
    }

    const chineseTitle = title;
    const foreignTitle = $('span[property="v:itemreviewed"]')
      .text()
      .replace(chineseTitle, '')
      .trim();

    const akaRow = rows['又名'];
    const akaRaw = akaRow?.links.length ? akaRow.links.join(' / ') : akaRow?.text || '';
    const aka = akaRaw
      ? akaRaw
          .split(' / ')
          .map((x) => x.trim())
          .filter(Boolean)
          .sort()
      : [];

    this.setTitles(info, {
      chinese_title: chineseTitle,
      foreign_title: foreignTitle,
      aka: aka.join('/'),
    });

    const yearRaw = $('#content > h1 > span.year').text();
    info.year = yearRaw ? ' ' + yearRaw.substr(1, 4) : '';

    const regionRaw = rows['制片国家/地区']?.links.length
      ? rows['制片国家/地区'].links.join(' / ')
      : rows['制片国家/地区']?.text || '';
    info.region = regionRaw ? regionRaw.split(' / ') : [];

    info.genre = $('#info span[property="v:genre"]')
      .map((_, el) => $(el).text().trim())
      .toArray() as string[];

    const languageRaw = rows['语言']?.links.length
      ? rows['语言'].links.join(' / ')
      : rows['语言']?.text || '';
    info.language = languageRaw ? languageRaw.split(' / ') : [];

    info.playdate = sortPlaydates(
      $('#info span[property="v:initialReleaseDate"]')
        .map((_, el) => $(el).text().trim())
        .toArray() as string[]
    );

    info.episodes = rows['集数']?.links[0] || rows['集数']?.text || '';
    info.seasons = rows['季数']?.links[0] || rows['季数']?.text || '';

    const singleEpDuration = rows['单集片长']?.links[0] || rows['单集片长']?.text || '';
    info.duration =
      singleEpDuration ||
      rows['片长']?.links[0] ||
      rows['片长']?.text ||
      $('#info span[property="v:runtime"]').text().trim();

    info.director = this.rowLinks(rows, '导演', info.director);
    info.writer = this.rowLinks(rows, '编剧', info.writer);
    info.cast = this.rowLinks(rows, '主演', info.cast);
  }

  private applyIntroAndTags(info: MediaInfo, $: ReturnType<typeof pageParser>): void {
    const introNode = $(
      '#link-report-intra > span.all.hidden, #link-report-intra > [property="v:summary"], #link-report > span.all.hidden, #link-report > [property="v:summary"]'
    );
    info.introduction = (introNode.length > 0 ? introNode.text() : '暂无相关剧情介绍')
      .split('\n')
      .map((a) => a.trim())
      .filter((a) => a.length > 0)
      .join('\n');

    const tagNodes = $('div.tags-body > a[href^="/tag"]');
    if (tagNodes.length > 0) {
      info.tags = tagNodes.map((_, el) => $(el).text()).get() as string[];
    }
  }

  private applyRexxarData(info: MediaInfo, data: any): void {
    const name = (p: any) => String(p?.name || '').trim();

    const directors = ensureArray(data.directors).map(name).filter(Boolean);
    if (directors.length) info.director = directors;

    const actors = ensureArray(data.actors).map(name).filter(Boolean);
    if (actors.length) info.cast = actors;

    const languages = ensureArray(data.languages).map(String).filter(Boolean);
    if (languages.length) info.language = languages;

    const countries = ensureArray(data.countries).map(String).filter(Boolean);
    if (countries.length) info.region = countries;

    const genres = ensureArray(data.genres).map(String).filter(Boolean);
    if (genres.length) info.genre = genres;

    const durations = ensureArray(data.durations).map(String).filter(Boolean);
    if (durations.length && !info.duration) info.duration = durations[0];

    const pubdates = ensureArray(data.pubdate).map(String).filter(Boolean);
    if (pubdates.length) info.playdate = sortPlaydates(pubdates);

    if (!info.episodes && data.episodes_count) {
      info.episodes = String(data.episodes_count);
    }

    const aka = ensureArray(data.aka).map(String).filter(Boolean);
    if (aka.length && !info.aka.length) {
      info.aka = aka;
      this.setTitles(info, {
        chinese_title: info.chinese_title,
        foreign_title: info.foreign_title,
        aka: aka.join('/'),
      });
    }

    const rating = data.rating;
    if (rating && !info.douban_rating_average) {
      info.douban_rating_average = Number(rating.value) || 0;
      info.douban_votes = Number(rating.count) || 0;
      if (info.douban_rating_average && info.douban_votes) {
        info.douban_rating = `${info.douban_rating_average}/10 from ${info.douban_votes} users`;
        info.ratings = {
          douban: {
            average: info.douban_rating_average,
            votes: info.douban_votes,
            formatted: info.douban_rating,
            link: info.douban_link || '',
          },
        };
      }
    }

    if (!info.poster && data.pic) {
      const pic = data.pic;
      if (pic.normal || pic.large || pic.original) {
        info.poster = String(pic.large || pic.normal || pic.original || '');
      } else if (data.cover_url) {
        info.poster = String(data.cover_url);
      }
    }

    const year = String(data.year || '').trim();
    if (year && !info.year.trim()) info.year = ` ${year}`;
  }

  private parseMobileSubjectHtml($: any, sid: string, link: string, rexxarData?: any): MediaInfo {
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

    const foreignTitle = original ? original.replace(/[（(]\s*\d{4}.*?[）)]\s*$/, '').trim() : '';

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
          link: link,
        },
      };
    }

    const meta = $('.sub-meta').first().text().replace(/\s+/g, ' ').trim();
    const parts = meta
      ? meta
          .split(' / ')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

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

    // Enrich with the rexxar API data (crew is rendered via JS on mobile pages).
    if (rexxarData && typeof rexxarData === 'object') {
      this.applyRexxarData(info, rexxarData);
    }

    // Some mobile pages still carry a desktop-style #info block with director/cast/episodes.
    if ($('#info').length > 0) {
      const infoRows = this.parseInfoRows($);
      if (!info.director.length) info.director = this.rowLinks(infoRows, '导演', []);
      if (!info.writer.length) info.writer = this.rowLinks(infoRows, '编剧', []);
      if (!info.cast.length) info.cast = this.rowLinks(infoRows, '主演', []);
      if (!info.episodes)
        info.episodes = infoRows['集数']?.links[0] || infoRows['集数']?.text || '';
      if (!info.seasons) info.seasons = infoRows['季数']?.links[0] || infoRows['季数']?.text || '';
      if (!info.duration) {
        const singleEp = infoRows['单集片长']?.links[0] || infoRows['单集片长']?.text || '';
        info.duration = singleEp || infoRows['片长']?.links[0] || infoRows['片长']?.text || '';
      }
    }

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
