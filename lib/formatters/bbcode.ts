import { Formatter } from '../interfaces/formatter';
import { MediaInfo } from '../types/schema';
import { normalizeMaybeArray, normalizePeople } from '../utils/string';
import { ensureArray } from '../utils/array';

export class BBCodeFormatter implements Formatter {
    format(data: MediaInfo): string {
        // Source-specific override (e.g. Steam, Bangumi)
        if (data.extra?.descr_bbcode) {
            return String(data.extra.descr_bbcode).trim();
        }

        const poster = String(data?.poster || '');
        const trans_title = normalizeMaybeArray(data?.trans_title).trim();
        const this_title = normalizeMaybeArray(data?.this_title).trim();
        const year = String(data?.year || '').trim();
        const region = Array.isArray(data?.region)
            ? data.region.join(' / ')
            : String(data?.region || '');
        const genre = ensureArray(data?.genre).filter(Boolean);
        const language = Array.isArray(data?.language)
            ? data.language.join(' / ')
            : String(data?.language || '');
        const playdate = ensureArray(data?.playdate).filter(Boolean);
        const imdb_rating = String(data?.imdb_rating || '');
        const imdb_link = String(data?.imdb_link || '');
        const douban_rating = String(data?.douban_rating || '');
        const douban_link = String(data?.douban_link || '');
        const tmdb_rating = String(data?.tmdb_rating || '');
        const tmdb_link = String(data?.tmdb_link || '');
        const episodes = String(data?.episodes || '');
        const seasons = String(data?.seasons || '');
        const duration = String(data?.duration || '');
        const director = normalizePeople(data?.director);
        const writer = normalizePeople(data?.writer);
        const cast = normalizePeople(data?.cast);
        const tags = ensureArray(data?.tags).filter(Boolean);
        const introduction = String(data?.introduction || '');
        const awards = String(data?.awards || '');

        let descr = poster ? `[img]${poster}[/img]\n\n` : '';
        descr += trans_title ? `◎译　　名　${trans_title}\n` : '';
        descr += this_title ? `◎片　　名　${this_title}\n` : '';
        descr += year ? `◎年　　代　${year}\n` : '';
        descr += region ? `◎产　　地　${region}\n` : '';
        descr += genre.length > 0 ? `◎类　　别　${genre.join(' / ')}\n` : '';
        descr += language ? `◎语　　言　${language}\n` : '';
        descr +=
            playdate.length > 0 ? `◎上映日期　${playdate.join(' / ')}\n` : '';
        descr += imdb_rating ? `◎IMDb评分  ${imdb_rating}\n` : '';
        descr += imdb_link ? `◎IMDb链接  ${imdb_link}\n` : '';
        descr += douban_rating ? `◎豆瓣评分　${douban_rating}\n` : '';
        descr += douban_link ? `◎豆瓣链接　${douban_link}\n` : '';
        descr += tmdb_rating ? `◎TMDB评分　${tmdb_rating}\n` : '';
        descr += tmdb_link ? `◎TMDB链接　${tmdb_link}\n` : '';
        descr += seasons ? `◎季　　数　${seasons}\n` : '';
        descr += episodes ? `◎集　　数　${episodes}\n` : '';
        descr += duration ? `◎片　　长　${duration}\n` : '';
        descr +=
            director.length > 0 ? `◎导　　演　${director.join(' / ')}\n` : '';
        descr += writer.length > 0 ? `◎编　　剧　${writer.join(' / ')}\n` : '';
        descr +=
            cast.length > 0
                ? `◎主　　演　${cast.join('\n' + '　'.repeat(4) + '  　').trim()}\n`
                : '';
        descr += tags.length > 0 ? `\n◎标　　签　${tags.join(' | ')}\n` : '';
        descr += introduction
            ? `\n◎简　　介\n\n　　${introduction.replace(
                /\n/g,
                '\n' + '　'.repeat(2)
            )}\n`
            : '';
        descr += awards
            ? `\n◎获奖情况\n\n　　${awards.replace(
                /\n/g,
                '\n' + '　'.repeat(2)
            )}\n`
            : '';

        return descr.trim();
    }
}
