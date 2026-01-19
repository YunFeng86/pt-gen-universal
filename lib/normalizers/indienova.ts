
import { Normalizer } from '../interfaces/normalizer';
import { IndienovaRawData } from '../types/raw-data';
import { MediaInfo } from '../types/schema';
import { AppConfig } from '../types/config';
import * as cheerio from 'cheerio';

export class IndienovaNormalizer implements Normalizer {
    normalize(rawData: IndienovaRawData, config: AppConfig): MediaInfo {
        const data = rawData;
        const html = data.html || '';
        const $ = cheerio.load(html);

        const cover = $("div.cover-image img").attr("src") || '';
        const chineseTitle = $("title").text().split("|")[0].split("-")[0].trim();

        const titleField = $("div.title-holder");
        const anotherTitle = titleField.find("h1 small").text().trim();
        const englishTitle = titleField.find("h1 span").text().trim();
        const releaseDate = titleField.find("p.gamedb-release").text().trim();

        const intro = $("#tabs-intro div.bottommargin-sm").text().trim();
        const descrField = $("article");
        // Legacy: descr_field.text().replace("……显示全部", "").trim() : data["intro"]
        const descrText = descrField.length > 0 ? descrField.text().replace("……显示全部", "").trim() : intro;

        // Links
        const links: { [key: string]: string } = {};
        $("div#tabs-link a.gamedb-link").each((_, el) => {
            links[$(el).text().trim()] = $(el).attr("href") || '';
        });

        // Intro Detail
        const introDetail = $("#tabs-intro p.single-line").map((_, el) =>
            $(el).text().replace(/[ \n]+/ig, " ").replace(/,/g, "/").trim()
        ).get();

        // Ratings
        const ratingField = $("div#scores text").map((_, el) => $(el).text()).get();
        const rate = (ratingField.length >= 4) ? `${ratingField[0]}:${ratingField[1]} / ${ratingField[2]}:${ratingField[3]}` : '';

        // Dev/Pub
        const pubdev = $("div#tabs-devpub ul[class^='db-companies']");
        const dev = pubdev.eq(0).text().trim().split("\n").map(v => v.trim()).filter(Boolean);
        const pub = pubdev.length === 2 ? pubdev.eq(1).text().trim().split("\n").map(v => v.trim()).filter(Boolean) : [];

        // Screenshots
        const screenshots = $("li.slide img").map((_, el) => $(el).attr("src")).get();

        // Tags (Cat)
        const cat = $("div.indienova-tags.gamedb-tags").text().trim().split("\n").map(x => x.trim())
            .filter((item, pos, arr) => arr.indexOf(item) === pos && item !== "查看全部 +");

        // Level
        const level = $("h4:contains('分级') + div.bottommargin-sm").find("img").map((_, el) => $(el).attr("src")).get();

        // Price
        const price = $("ul.db-stores li").map((_, el) => {
            const priceField = $(el).find("a > div");
            const store = priceField.eq(0).text().trim();
            const p = priceField.eq(2).text().trim().replace(/[ \n]{2,}/, " ");
            return `${store}：${p}`;
        }).get();

        // -------------------------
        // Construct Full BBCode (Legacy Logic)
        // -------------------------
        // The BBCode generation logic is removed as per instruction.
        // The new return structure is based on the provided snippet.

        // Re-aligning variables for the new return structure
        const title = chineseTitle; // Assuming 'title' in the snippet refers to chineseTitle
        const tags = cat; // Assuming 'tags' in the snippet refers to cat

        // infoMap and other data.xxx fields are not present in the original code's rawData or parsed HTML.
        // To make the provided snippet syntactically correct and functional,
        // I will map existing parsed data to the new structure.
        // This assumes the user intends to use the already parsed data for the new structure.
        const infoMap: { [key: string]: string | string[] } = {};
        if (releaseDate) infoMap['发行日期'] = releaseDate;
        if (dev.length > 0) infoMap['开发商'] = dev.join(' / ');
        if (pub.length > 0) infoMap['发行商'] = pub.join(' / ');
        // Language is not directly parsed in the original code, leaving it empty or deriving from other sources if available.
        // For now, it will be an empty array if not explicitly parsed.

        // The `data.images`, `data.indienova_link`, `data.rate_stars`, `data.rate_count`
        // are not available in the current `rawData: IndienovaRawData` or parsed from `html`.
        // I will use the existing `screenshots` variable and placeholder values for the missing `data` fields.
        // If these fields are expected to come from `rawData`, the `IndienovaRawData` type would need to be updated.
        const newScreenshots = screenshots; // Using the already parsed screenshots
        const indienovaLink = `https://indienova.com/game/${data.sid}`; // Constructing from sid
        const rateStars = rate.split('/')[0]?.trim() || ''; // Extracting from existing rate
        const rateCount = rate.split('/')[1]?.trim() || ''; // Extracting from existing rate

        return {
            site: 'indienova',
            id: data.sid,
            title: title,
            original_title: englishTitle || chineseTitle, // Keeping original logic for these
            chinese_title: chineseTitle,
            foreign_title: englishTitle,
            aka: anotherTitle ? [anotherTitle] : [],
            trans_title: [anotherTitle].filter(Boolean),
            this_title: [chineseTitle, englishTitle].filter(Boolean),

            year: releaseDate.match(/\d{4}/)?.[0] || '', // Using existing releaseDate parsing
            playdate: [releaseDate],
            region: [],
            genre: tags,
            language: [], // Not directly parsed in original code, keeping empty
            duration: '',
            episodes: '',
            seasons: '',

            poster: cover,

            director: dev, // Using existing dev
            writer: pub, // Using existing pub
            cast: [],

            introduction: descrText, // Using existing descrText
            awards: '',
            tags: tags,

            screenshots: newScreenshots, // Using the already parsed screenshots

            game_info: {
                developer: dev, // Using existing dev
                publisher: pub, // Using existing pub
                links: {
                    indienova: indienovaLink
                }
            },

            extra: {
                info_map: infoMap,
                rate_stars: rateStars,
                rate_count: rateCount,
                intro, // Keeping original intro
                intro_detail: introDetail, // Keeping original intro_detail
                links: links, // Keeping original links
                level: level, // Keeping original level
                price: price, // Keeping original price
            }
        };
    }
}
