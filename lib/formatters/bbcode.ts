import { Formatter } from '../interfaces/formatter';
import { MediaExtras, MediaInfo } from '../types/schema';
import { normalizeMaybeArray, normalizePeople } from '../utils/string';
import { ensureArray } from '../utils/array';
import { GAME_INSTALL_TEMPLATE } from '../utils/legacy-utils';

export class BBCodeFormatter implements Formatter {
    format(data: MediaInfo): string {
        // If it's a game (determined by site or presence of game_info), use game formatter
        if (['steam', 'indienova', 'gog'].includes(data.site) || data.game_info) {
            return this.formatGame(data);
        }
        return this.formatMovie(data);
    }

    private formatMovie(data: MediaInfo): string {
        // Source-specific override (legacy compat, though we tried to remove it)
        if (data.extras?.descr_bbcode) {
            return String(data.extras.descr_bbcode).trim();
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

        // Ratings & Links
        const imdb_rating =
            data.ratings?.imdb?.formatted ||
            String(data.imdb_rating || '') ||
            (data.imdb_rating_average && data.imdb_votes
                ? `${data.imdb_rating_average}/10 from ${data.imdb_votes} users`
                : '');
        const imdb_link = data.ratings?.imdb?.link || String(data.imdb_link || '');

        const douban_rating =
            data.ratings?.douban?.formatted ||
            String(data.douban_rating || '') ||
            (data.douban_rating_average && data.douban_votes
                ? `${data.douban_rating_average}/10 from ${data.douban_votes} users`
                : '');
        const douban_link = data.ratings?.douban?.link || String(data.douban_link || '');

        const tmdb_rating =
            data.ratings?.tmdb?.formatted ||
            String(data.tmdb_rating || '') ||
            (data.tmdb_rating_average && data.tmdb_votes
                ? `${data.tmdb_rating_average}/10 from ${data.tmdb_votes} users`
                : '');
        const tmdb_link = data.ratings?.tmdb?.link || String(data.tmdb_link || '');

        // Bangumi specific
        const bangumi_rating =
            data.ratings?.bangumi?.formatted ||
            (data.bangumi_rating_average && data.bangumi_votes
                ? `${data.bangumi_rating_average}/10 from ${data.bangumi_votes} users`
                : '');
        const bangumi_link =
            data.ratings?.bangumi?.link ||
            (data.site === 'bangumi'
                ? String(data.link || `https://bgm.tv/subject/${data.id}`)
                : '');

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
        descr += playdate.length > 0 ? `◎上映日期　${playdate.join(' / ')}\n` : '';

        if (imdb_rating) descr += `◎IMDb评分  ${imdb_rating}\n`;
        if (imdb_link) descr += `◎IMDb链接  ${imdb_link}\n`;

        if (douban_rating) descr += `◎豆瓣评分　${douban_rating}\n`;
        if (douban_link) descr += `◎豆瓣链接　${douban_link}\n`;

        if (tmdb_rating) descr += `◎TMDB评分　${tmdb_rating}\n`;
        if (tmdb_link) descr += `◎TMDB链接　${tmdb_link}\n`;

        if (bangumi_rating) descr += `◎Bangumi评分　${bangumi_rating}\n`;
        if (bangumi_link) descr += `◎Bangumi链接　${bangumi_link}\n`;

        descr += seasons ? `◎季　　数　${seasons}\n` : '';
        descr += episodes ? `◎集　　数　${episodes}\n` : '';
        descr += duration ? `◎片　　长　${duration}\n` : '';
        descr += director.length > 0 ? `◎导　　演　${director.join(' / ')}\n` : '';
        descr += writer.length > 0 ? `◎编　　剧　${writer.join(' / ')}\n` : '';

        descr += cast.length > 0
            ? `◎主　　演　${cast.slice(0, 15).join('\n' + '　'.repeat(4) + '  　').trim()}\n`
            : '';

        if (data.extras?.staff && data.extras?.staff.length > 0) {
            // Bangumi often has a dedicated staff list
            const otherStaff = data.extras.staff.filter((s: string) =>
                !s.includes("监督") && !s.includes("导演") &&
                !s.includes("脚本") && !s.includes("系列构成")
            ).slice(0, 15);
            if (otherStaff.length > 0) {
                descr += `\n◎制作人员\n\n　　${otherStaff.join("\n　　")}\n`;
            }
        }

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

        if (bangumi_link) {
            descr += `\n(来源于 ${bangumi_link} )\n`;
        }

        return descr.trim();
    }

    private formatGame(data: MediaInfo): string {
        const poster = String(data?.poster || '');
        const title = data.chinese_title || data.foreign_title;
        const gameInfo = data.game_info || {};
        const extra = (data.extras || data.extra || {}) as MediaExtras;

        let descr = poster ? `[img]${poster}[/img]\n\n` : '';

        // Header Image (Steam)
        if (data.site === 'steam' && data.id) {
            const headerImg = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${data.id}/header.jpg`;
            //  const libraryImg = `https://steamcdn-a.akamaihd.net/steam/apps/${data.id}/library_600x900_2x.jpg`;
            descr += `[img]${headerImg}[/img]\n\n`;
        }

        descr += "【基本信息】\n\n";
        if (title) descr += `名称: ${title}\n`;
        if (data.foreign_title && data.foreign_title !== title) {
            descr += `英文名称: ${data.foreign_title}\n`;
        }

        // Steam specific raw lines (preserved for fidelity)
        if (extra.type_line) descr += `${extra.type_line}\n`;
        if (extra.dev_line) descr += `${extra.dev_line}\n`;
        if (extra.pub_line) descr += `${extra.pub_line}\n`;
        if (extra.release_line) descr += `${extra.release_line}\n`;

        // Generic Game Info (if raw lines missing)
        if (!extra.dev_line && gameInfo.developer?.length) descr += `开发商: ${gameInfo.developer.join(' / ')}\n`;
        if (!extra.pub_line && gameInfo.publisher?.length) descr += `发行商: ${gameInfo.publisher.join(' / ')}\n`;
        if (!extra.release_line && data.year) descr += `发行日期: ${data.playdate?.[0] || data.year}\n`;

        if (gameInfo.platform?.length) descr += `平台: ${gameInfo.platform.join(' / ')}\n`;
        if (data.genre?.length) descr += `类型: ${data.genre.join(' / ')}\n`;
        if (gameInfo.price?.length) descr += `售价: ${gameInfo.price.join(' / ')}\n`;
        if (extra.rate_stars) descr += `评分: ${extra.rate_stars} / 5.0 (${extra.rate_count || 0} 人评)\n`;

        // Links
        if (gameInfo.links) {
            if (gameInfo.links.linkbar) descr += `官方网站: ${gameInfo.links.linkbar}\n`;
            if (gameInfo.links.steam) descr += `Steam页面: ${gameInfo.links.steam}\n`;
            if (gameInfo.links.indienova) descr += `Indienova页面: ${gameInfo.links.indienova}\n`;
            if (gameInfo.links.gog) descr += `GOG页面: ${gameInfo.links.gog}\n`;
        }

        // Languages
        if (gameInfo.ui_lang?.length || gameInfo.audio_lang?.length || extra.languages?.length) {
            descr += "游戏语种: ";
            if (gameInfo.ui_lang?.length) descr += `[b]界面和字幕语言[/b]: ${gameInfo.ui_lang.join("、")}\n`;
            if (gameInfo.audio_lang?.length) descr += "　　　　  [b]完全音频语言[/b]: " + gameInfo.audio_lang.join("、") + "\n";
            // Fallback for simple list (GOG/Indienova)
            if (!gameInfo.ui_lang?.length && !gameInfo.audio_lang?.length && extra.languages?.length) {
                descr += `${extra.languages.join("、")}\n`;
            } else if (!gameInfo.ui_lang?.length && !gameInfo.audio_lang?.length && data.language?.length) {
                descr += `${data.language.join("、")}\n`;
            }
        }

        descr += "\n【游戏简介】\n\n";
        const intro = data.introduction || extra.intro || '';
        if (intro) descr += `${intro}\n\n`;

        descr += GAME_INSTALL_TEMPLATE + "\n\n";

        // System Requirements
        if (extra.sysreq || extra.system_requirements) {
            const sys = extra.sysreq ?? extra.system_requirements;
            descr += "【配置需求】\n\n";

            // Steam style (already array of strings per OS)
            if (Array.isArray(sys)) {

                // Try legacy steam extraction logic if available (windows_min/rec)
                if (extra.windows_min?.length || extra.windows_rec?.length) {
                    descr += "Windows\n\n";
                    if (extra.windows_min?.length) {
                        descr += "[b]最低配置[/b]\n";
                        descr += this.formatSysLines(extra.windows_min) + "\n";
                    }
                    if (extra.windows_rec?.length) {
                        descr += "[b]推荐配置[/b]\n";
                        descr += this.formatSysLines(extra.windows_rec) + "\n";
                    }
                    descr += "\n";
                } else {
                    // Fallback to raw dump if not parsed separate fields
                    sys.forEach(s => descr += s + "\n\n");
                }
            }
            // GOG style (structured object)
            else if (sys && typeof sys === 'object') {
                for (let [osName, osData] of Object.entries(sys as Record<string, any>)) {
                    let osDisplayName = osName === "windows" ? "Windows" :
                        osName === "osx" ? "Mac OS X" :
                            osName === "linux" ? "Linux" : osName;

                    descr += `${osDisplayName}`;
                    if (osData.versions) descr += ` (${osData.versions})`;
                    descr += ":\n\n";

                    let reqs = osData.requirements || {};

                    // Minimum
                    if (reqs.minimum) {
                        descr += "最低配置:\n";
                        for (let [reqId, reqDesc] of Object.entries(reqs.minimum) as any) {
                            let reqName = reqId.charAt(0).toUpperCase() + reqId.slice(1);
                            descr += `  ${reqName}: ${reqDesc}\n`;
                        }
                        descr += "\n";
                    }

                    // Recommended
                    if (reqs.recommended) {
                        descr += "推荐配置:\n";
                        for (let [reqId, reqDesc] of Object.entries(reqs.recommended) as any) {
                            let reqName = reqId.charAt(0).toUpperCase() + reqId.slice(1);
                            descr += `  ${reqName}: ${reqDesc}\n`;
                        }
                        descr += "\n";
                    }
                }
            }
        }

        // Screenshots
        const infoMap = extra.info_map as Record<string, unknown> | undefined;
        const infoMapScreenshots = infoMap && Array.isArray((infoMap as any).screenshots) ? (infoMap as any).screenshots : undefined;
        const screenshots = data.screenshots || extra.screenshots || infoMapScreenshots; // Indienova legacy path?
        if (Array.isArray(screenshots) && screenshots.length > 0) {
            descr += "【游戏截图】\n\n";
            descr += screenshots.map((x: string) => `[img]${x}[/img]`).join("\n") + "\n\n";
        }

        return descr.trim();
    }

    // Helper to format key-value style sysreq lines (Steam style)
    private formatSysLines(lines: string[]) {
        return lines.map(line => {
            const m = line.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
            return m ? `[*][b]${m[1]}[/b]: ${m[2]}` : `[*]${line}`;
        }).join("\n");
    }
}
