
import { Normalizer } from '../interfaces/normalizer';
import { SteamRawData } from '../types/raw-data';
import { MediaInfo } from '../types/schema';
import { AppConfig } from '../types/config';
import * as cheerio from 'cheerio';
import { html2bbcode, GAME_INSTALL_TEMPLATE } from '../utils/legacy-utils';

export class SteamNormalizer implements Normalizer {
    normalize(rawData: SteamRawData, config: AppConfig): MediaInfo {
        const data = rawData;
        const mainHtml = data.main_html || '';
        const $ = cheerio.load(mainHtml);
        const steamCn: any = data.steamcn_data || {};

        // Name
        const nameAnchor = $("div.apphub_AppName");
        // Fallback for name if main selector fails
        const name = nameAnchor.length ? nameAnchor.text().trim() : ($("span[itemprop='name']").text().trim() || '');

        let chineseName = '';
        if (steamCn.name_cn) chineseName = steamCn.name_cn;

        // Cover
        const coverAnchor = $("img.game_header_image_full[src]");
        const poster = coverAnchor.length ? coverAnchor.attr("src")?.replace(/^(.+?)(\?t=\d+)?$/, "$1") || '' : '';

        // Detail Block Parsing
        const detailAnchor = $("div.details_block");
        const detailsText = detailAnchor.length ? detailAnchor.eq(0).text() : '';
        const detailLines = detailsText.replace(/:[ \t\n]+/g, ": ").split("\n").map(x => x.trim()).filter(x => x.length > 0);

        // Extract Detail Fields
        let releaseDate = '';
        let dev = '';
        let pub = '';

        // Additional detailed lines for formatted description
        let typeLine = "";
        let devLine = "";
        let pubLine = "";
        let releaseLine = "";

        detailLines.forEach(line => {
            // For Schema
            if (line.startsWith("发行日期:")) releaseDate = line.replace("发行日期:", "").trim();
            else if (line.startsWith("开发者:")) dev = line.replace("开发者:", "").trim();
            else if (line.startsWith("发行商:")) pub = line.replace("发行商:", "").trim();

            // For Description
            if (line.startsWith("类型:")) typeLine = line;
            else if (line.startsWith("开发者:")) devLine = line;
            else if (line.startsWith("发行商:")) pubLine = line;
            else if (line.startsWith("发行日期:")) releaseLine = line;
        });

        // Tags
        const tags = $("a.app_tag").map((_, el) => $(el).text().trim()).get();

        // Website Link
        const linkbarAnchor = $("a.linkbar");
        let linkbar = "";
        if (linkbarAnchor.length > 0) {
            let href = linkbarAnchor.attr("href") || "";
            // Decode URL redirect
            let match = href.match(/url=([^&]+)/);
            if (match) {
                try {
                    href = decodeURIComponent(match[1]);
                } catch (e) {
                    href = match[1];
                }
            }
            linkbar = href;
        }

        // Languages
        const languageAnchor = $("table.game_language_options tr[class!=unsupported]");
        const lagCheckColList = ["界面", "完全音频", "字幕"];
        const languagesRaw = languageAnchor.slice(1).map((_, el) => {
            const tag = $(el);
            const tds = tag.find("td");
            const lang = tds.eq(0).text().trim();
            const support: string[] = [];
            for (let i = 0; i < lagCheckColList.length; i++) {
                if (tds.eq(i + 1).text().includes("✔")) support.push(lagCheckColList[i]);
            }
            return `${lang}${support.length > 0 ? ` (${support.join(", ")})` : ""}`;
        }).get();

        // Categorize Languages for Description
        const uiAndSubLangs: string[] = [];
        const fullAudioLangs: string[] = [];
        languagesRaw.forEach(l => {
            let name = l;
            let caps: string[] = [];
            const m = l.match(/^(.+?)\s*\((.+)\)$/);
            if (m) {
                name = m[1].trim();
                caps = m[2].split(/\s*,\s*/);
            }
            if (caps.includes("界面") && caps.includes("字幕")) {
                uiAndSubLangs.push(name);
            }
            if (caps.includes("完全音频")) {
                fullAudioLangs.push(name);
            }
        });

        // Description Cleaning
        const descrAnchor = $("div#game_area_description");
        let descrBBCode = "";
        let cleanDescr = "";
        if (descrAnchor.length) {
            let html = descrAnchor.html() || '';
            descrBBCode = html2bbcode(html);
            descrBBCode = descrBBCode
                .replace(/\[h2\]关于这款游戏\[\/h2\]/ig, "")
                .replace(/\[h2\]关于此游戏\[\/h2\]/ig, "")
                .replace(/\[h2\]\s*\[\/h2\]/ig, "")
                .replace(/\[h2\]([\s\S]*?)\[\/h2\]/ig, "$1")
                .replace(/\[img\][\s\S]*?\[\/img\]/ig, "")
                .replace(/\[\/?(ul|ol|list)\]/ig, "")
                .replace(/\[li\]/ig, "[*]")
                .replace(/\[\/li\]/ig, "");

            cleanDescr = descrBBCode.split("\n").map(x => x.trim()).filter(x => x.length > 0).join("\n").trim();
        }

        // Screenshots
        function normalizeScreenshotUrl(url: string) {
            if (!url) return "";
            url = url.replace(/&amp;/g, "&").replace(/\?t=\d+$/, "");
            const m = url.match(/^https?:\/\/[^\/]+(\/store_item_assets\/steam\/apps\/.+)$/);
            if (m) return "https://shared.akamai.steamstatic.com" + m[1];
            return url;
        }

        let screenshots: string[] = [];
        const screenshotPropsDiv = $("div.gamehighlight_desktopcarousel[data-props]");
        if (screenshotPropsDiv.length) {
            try {
                const propsRaw = screenshotPropsDiv.attr("data-props") || "";
                const props = JSON.parse(propsRaw.replace(/&quot;/g, '"'));
                if (props && Array.isArray(props.screenshots)) {
                    screenshots = props.screenshots.map((s: any) => normalizeScreenshotUrl(s.full || s.standard || s.thumbnail));
                }
            } catch { }
        }
        if (screenshots.length === 0) {
            $("div.screenshot_holder a").each((_, el) => {
                const href = $(el).attr("href") || "";
                const cleaned = href.replace(/^.+?url=(http.+?)\.[\dx]+(.+?)(\?t=\d+)?$/, "$1$2");
                screenshots.push(normalizeScreenshotUrl(cleaned));
            });
        }

        // SysReq Parsing
        const osDict: { [key: string]: string } = { "win": "Windows", "mac": "Mac OS X", "linux": "SteamOS + Linux" };
        const sysreq = $("div.sysreq_contents > div.game_area_sys_req").map((_, el) => {
            const tag = $(el);
            const os = osDict[tag.attr("data-os") || ""] || tag.attr("data-os");
            const clone = tag.clone();
            clone.html(tag.html()?.replace(/<br>/ig, "[br]") || "");
            const content = clone.text()
                .split("\n").map(x => x.trim()).filter(x => x.length > 0).join("\n\n")
                .split("[br]").map(x => x.trim()).filter(x => x.length > 0).join("\n");
            return `${os}\n${content}`;
        }).get();

        // Categorize SysReq for Description (Windows Only logic from legacy)
        const windowsMin: string[] = [];
        const windowsRec: string[] = [];
        const winBlock = sysreq.find(x => x.startsWith("Windows"));
        if (winBlock) {
            const lines = winBlock.split("\n").slice(1);
            let section = "";
            lines.forEach(line => {
                line = line.trim();
                if (!line) return;
                if (line.startsWith("最低配置")) { section = "min"; return; }
                if (line.startsWith("推荐配置")) { section = "rec"; return; }
                if (section === "min") windowsMin.push(line);
                else if (section === "rec") windowsRec.push(line);
            });
        }

        function formatSysLines(lines: string[]) {
            return lines.map(line => {
                const m = line.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
                return m ? `[*][b]${m[1]}[/b]: ${m[2]}` : `[*]${line}`;
            }).join("\n");
        }

        // Construct Display Name
        let displayName = "";
        if (chineseName) displayName = chineseName.trim();
        else if (steamCn.name) displayName = steamCn.name.trim(); // Check steamCn.name as backup
        else {
            // Try extraction from detail block
            // Current logic doesn't extract name from Detail Block lines into `nameLine` yet,
            // but `name` const at top should cover it.
            displayName = name;
        }


        // Construct Formatted Description (BBCode)
        let descr = "";
        const headerImg = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${data.sid}/header.jpg`;
        const libraryImg = `https://steamcdn-a.akamaihd.net/steam/apps/${data.sid}/library_600x900_2x.jpg`;

        descr += `[img]${headerImg}[/img]\n\n`;
        descr += `[img]${libraryImg}[/img]\n\n`;

        descr += "【基本信息】\n\n";
        if (displayName) descr += `名称: ${displayName}\n`;
        if (typeLine) descr += `${typeLine}\n`;
        if (devLine) descr += `${devLine}\n`;
        if (pubLine) descr += `${pubLine}\n`;
        if (releaseLine) descr += `${releaseLine}\n`;
        if (linkbar) descr += `官方网站: ${linkbar}\n`;
        if (data.sid) descr += `Steam页面: https://store.steampowered.com/app/${data.sid}\n`;

        if (uiAndSubLangs.length > 0 || fullAudioLangs.length > 0) {
            descr += "游戏语种: ";
            if (uiAndSubLangs.length > 0) descr += `[b]界面和字幕语言[/b]: ${uiAndSubLangs.join("、")}\n`;
            if (fullAudioLangs.length > 0) descr += "　　　　  [b]完全音频语言[/b]: " + fullAudioLangs.join("、") + "\n";
        }

        descr += "\n【游戏简介】\n\n";
        if (cleanDescr) descr += `${cleanDescr}\n\n`;

        descr += GAME_INSTALL_TEMPLATE + "\n\n";

        if (windowsMin.length > 0 || windowsRec.length > 0) {
            descr += "【配置需求】\n\n";
            descr += "Windows\n\n";
            if (windowsMin.length > 0) {
                descr += "[b]最低配置[/b]\n";
                descr += formatSysLines(windowsMin) + "\n";
            }
            if (windowsRec.length > 0) {
                descr += "[b]推荐配置[/b]\n";
                descr += formatSysLines(windowsRec) + "\n";
            }
            descr += "\n";
        }

        if (screenshots.length > 0) {
            descr += "【游戏截图】\n\n";
            descr += screenshots.map(x => `[img]${x}[/img]`).join("\n") + "\n\n";
        }


        // Start creating MediaInfo
        const info: MediaInfo = {
            site: 'steam',
            id: data.sid,
            title: displayName || name,
            original_title: name,
            chinese_title: chineseName,
            foreign_title: name,
            aka: [],
            trans_title: chineseName ? [chineseName] : [],
            this_title: [name],

            year: releaseDate ? releaseDate.match(/\d{4}/)?.[0] || '' : '',
            playdate: [releaseDate],
            region: [],
            genre: tags,
            language: [], // We can put simplified language list here if needed
            duration: '',
            episodes: '',
            seasons: '',

            poster: poster,

            director: dev ? [dev] : [],
            writer: pub ? [pub] : [],
            cast: [],

            introduction: cleanDescr,
            awards: '',
            tags: tags,

            extra: {
                steam_id: data.sid,
                linkbar: linkbar,
                languages_raw: languagesRaw,
                sysreq: sysreq,
                screenshots: screenshots,
                descr_bbcode: descr.trim() // Identify where to put the full formatted description. Legacy put it in `format`. We put it here for Formatter to use.
            }
        };

        return info;
    }
}
