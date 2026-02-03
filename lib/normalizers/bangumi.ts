
import { Normalizer } from '../interfaces/normalizer';
import { BangumiRawData } from '../types/raw-data';
import { MediaInfo } from '../types/schema';
import { AppConfig } from '../types/config';
import * as cheerio from 'cheerio';

export class BangumiNormalizer implements Normalizer {
    normalize(rawData: BangumiRawData, config: AppConfig): MediaInfo {
        const data = rawData;
        const mainHtml = data.main_html || '';
        const $ = cheerio.load(mainHtml);

        // Basic Info
        const infoList = $('ul#infobox li');
        const infoMap: { [key: string]: string } = {};
        const staff: string[] = [];

        infoList.each((_, el) => {
            const text = $(el).text();
            const match = text.match(/^([\u4e00-\u9fa5]+|[A-Za-z]+)[:：]\s*(.+)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                if (key === '别名' && infoMap[key]) {
                    infoMap[key] += ' / ' + value;
                } else {
                    infoMap[key] = value;
                }

                // Logic to separate staff from info
                if (!/^(中文名|话数|放送开始|放送星期|别名|官方网站|播放电视台|其他电视台|Copyright)/.test(key)) {
                    staff.push(text);
                }
            } else {
                if (!/^(中文名|话数|放送开始|放送星期|别名|官方网站|播放电视台|其他电视台|Copyright)/.test(text)) {
                    staff.push(text);
                }
            }
        });

        // Cover/Poster
        const coverEl = $("div#bangumiInfo").find("a.thickbox.cover");
        const poster = coverEl.length ? ("https:" + coverEl.attr("href")).replace(/\/cover\/[lcmsg]\//, "/cover/l/") : "";

        // Story
        const story = $("div#subject_summary").text().trim();

        // Ratings
        const voteCountRaw = $('span[property="v:votes"]').text();
        const ratingRaw = $('div.global_score > span[property="v:average"]').text();
        const votes = parseInt(voteCountRaw, 10) || 0;
        const rating = parseFloat(ratingRaw) || 0;

        // Tags
        const tags = $('#subject_detail > div.subject_tag_section > div > a > span').map((_, el) => $(el).text()).get();

        // Cast from Characters Page
        const cast: string[] = [];
        if (data.characters_html) {
            const $char = cheerio.load(data.characters_html);
            const actors = $char("div#columnInSubjectA > div.light_odd > div.clearit");
            actors.each((_, el) => {
                const tag = $char(el);
                const h2 = tag.find("h2");
                const tip = h2.find("span.tip");
                const charName = (tip.length ? tip.text() : h2.find("a").text()).replace(/\//, "").trim();

                const cvs = tag.find("div.clearit > p").map((__, pEl) => {
                    const p = $char(pEl);
                    const small = p.find("small");
                    return (small.length ? small : p.find("a")).text().trim();
                }).get().join("，");

                cast.push(`${charName}: ${cvs}`);
            });
        }

        // Aliases Parsing (Legacy Logic)
        const aliases: string[] = [];
        if (infoMap["中文名"]) aliases.push(infoMap["中文名"]);

        if (infoMap["别名"]) {
            const aliasText = infoMap["别名"];
            let inQuote = false;
            let currentAlias = '';

            for (let i = 0; i < aliasText.length; i++) {
                const char = aliasText[i];
                if (char === '"') {
                    inQuote = !inQuote;
                    currentAlias += char;
                } else if (char === '/' && !inQuote) {
                    if (currentAlias.trim()) aliases.push(currentAlias.trim());
                    currentAlias = '';
                } else {
                    currentAlias += char;
                }
            }
            if (currentAlias.trim()) aliases.push(currentAlias.trim());
        }
        const uniqueAliases = Array.from(new Set(aliases));

        // Directors & Writers for MediaInfo
        const directors = staff.filter(s => s.includes("监督") || s.includes("导演")).map(s => s.split(/[:：]/)[1]?.trim()).filter(Boolean);
        const writers = staff.filter(s => s.includes("脚本") || s.includes("系列构成")).map(s => s.split(/[:：]/)[1]?.trim()).filter(Boolean);

        const bangumiLink = `https://bgm.tv/subject/${data.sid}`;
        const mainTitle = $('h1.nameSingle > a').text().trim();
        const startYear = infoMap["放送开始"] ? infoMap["放送开始"].substring(0, 4) : '';

        return {
            site: 'bangumi',
            id: data.sid,
            link: bangumiLink,
            title: mainTitle,
            original_title: mainTitle, // Bangumi title logic is fuzzy
            chinese_title: infoMap["中文名"] || '',
            foreign_title: '',
            aka: uniqueAliases,
            trans_title: uniqueAliases,
            this_title: [mainTitle],

            year: startYear,
            playdate: infoMap["放送开始"] ? [infoMap["放送开始"]] : [],
            region: [],
            genre: tags,
            language: [],
            duration: '',
            episodes: infoMap["话数"] || '',
            seasons: '',

            poster: poster,

            director: directors,
            writer: writers,
            cast: cast,

            introduction: story,
            awards: '',
            tags: tags,

            bangumi_rating_average: rating,
            bangumi_votes: votes,
            ratings: rating && votes ? {
                bangumi: {
                    average: rating,
                    votes: votes,
                    formatted: `${rating}/10 from ${votes} users`,
                    link: bangumiLink
                }
            } : undefined,

            extras: {
                info_map: infoMap,
                staff: staff,
                aliases: uniqueAliases,
                rating: rating,
                votes: votes
            },
            extra: {
                info_map: infoMap,
                staff: staff,
                aliases: uniqueAliases,
                rating: rating,
                votes: votes
            }
        };
    }
}
