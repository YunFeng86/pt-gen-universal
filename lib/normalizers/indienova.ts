
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
        let bbcode = cover ? `[img]${cover}[/img]\n\n` : "";
        bbcode += "【基本信息】\n\n";

        if (chineseTitle) bbcode += `中文名称：${chineseTitle}\n`;
        if (englishTitle) bbcode += `英文名称：${englishTitle}\n`;
        if (anotherTitle) bbcode += `其他名称：${anotherTitle}\n`;
        if (releaseDate) bbcode += `发行时间：${releaseDate}\n`;
        if (rate) bbcode += `评分：${rate}\n`;
        if (dev.length > 0) bbcode += `开发商：${dev.join(" / ")}\n`;
        if (pub.length > 0) bbcode += `发行商：${pub.join(" / ")}\n`;
        if (introDetail.length > 0) bbcode += `${introDetail.join("\n")}\n`;
        if (cat.length > 0) bbcode += `标签：${cat.slice(0, 8).join(" | ")}\n`;

        if (Object.keys(links).length > 0) {
            const formatLinks = Object.entries(links).map(([key, value]) => `[url=${value}]${key}[/url]`);
            bbcode += `链接地址：${formatLinks.join("  ")}\n`;
        }

        if (price.length > 0) bbcode += `价格信息：${price.join(" / ")}\n`;
        bbcode += "\n";

        if (descrText) bbcode += `【游戏简介】\n\n${descrText}\n\n`;

        if (screenshots.length > 0) {
            bbcode += `【游戏截图】\n\n${screenshots.map(x => `[img]${x}[/img]`).join("\n")}\n\n`;
        }

        if (level.length > 0) {
            bbcode += `【游戏评级】\n\n${level.map(x => `[img]${x}[/img]`).join("\n")}\n\n`;
        }


        return {
            site: 'indienova',
            id: data.sid,
            title: chineseTitle,
            original_title: englishTitle || chineseTitle,
            chinese_title: chineseTitle,
            foreign_title: englishTitle,
            aka: anotherTitle ? [anotherTitle] : [],
            trans_title: [anotherTitle].filter(Boolean),
            this_title: [chineseTitle, englishTitle].filter(Boolean),

            year: releaseDate.match(/\d{4}/)?.[0] || '',
            playdate: [releaseDate],
            region: [],
            genre: cat,
            language: [],
            duration: '',
            episodes: '',
            seasons: '',

            poster: cover,

            director: dev,
            writer: pub,
            cast: [],

            introduction: descrText,
            awards: '',
            tags: cat,

            extra: {
                intro,
                intro_detail: introDetail,
                links: links,
                rate: rate,
                screenshots: screenshots,
                level: level,
                price: price,
                descr_bbcode: bbcode.trim() // Full Override
            }
        };
    }
}
