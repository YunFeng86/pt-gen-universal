import { Formatter } from '../interfaces/formatter';
import { MediaExtras, MediaInfo } from '../types/schema';
import { normalizeMaybeArray, normalizePeople } from '../utils/string';
import { ensureArray } from '../utils/array';

export class MarkdownFormatter implements Formatter {
    format(data: MediaInfo): string {
        // If it's a game (determined by site or presence of game_info), use game formatter
        if (['steam', 'indienova', 'gog'].includes(data.site) || data.game_info) {
            return this.formatGame(data);
        }
        return this.formatMovie(data);
    }

    private formatMovie(data: MediaInfo): string {
        const poster = String(data?.poster || '');
        const trans_title = normalizeMaybeArray(data?.trans_title).trim();
        const this_title = normalizeMaybeArray(data?.this_title).trim();
        const year = String(data?.year || '').trim();
        const region = Array.isArray(data?.region) ? data.region.join(' / ') : String(data?.region || '');
        const genre = ensureArray(data?.genre).filter(Boolean);
        const language = Array.isArray(data?.language) ? data.language.join(' / ') : String(data?.language || '');
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

        let descr = poster ? `![海报](${poster})\n\n` : '';
        descr += `## 基本信息\n\n`;
        descr += trans_title ? `- **译名**: ${trans_title}\n` : '';
        descr += this_title ? `- **片名**: ${this_title}\n` : '';
        descr += year ? `- **年代**: ${year}\n` : '';
        descr += region ? `- **产地**: ${region}\n` : '';
        descr += genre.length > 0 ? `- **类别**: ${genre.join(' / ')}\n` : '';
        descr += language ? `- **语言**: ${language}\n` : '';
        descr += playdate.length > 0 ? `- **上映日期**: ${playdate.join(' / ')}\n` : '';
        descr += seasons ? `- **季数**: ${seasons}\n` : '';
        descr += episodes ? `- **集数**: ${episodes}\n` : '';
        descr += duration ? `- **片长**: ${duration}\n` : '';

        if (
            imdb_rating || imdb_link ||
            douban_rating || douban_link ||
            tmdb_rating || tmdb_link ||
            bangumi_rating || bangumi_link
        ) {
            descr += `\n## 评分\n\n`;
            if (imdb_rating || imdb_link) {
                if (imdb_rating) {
                    descr += `- **IMDb**: ${imdb_rating}`;
                    if (imdb_link) descr += ` ([链接](${imdb_link}))`;
                    descr += `\n`;
                } else {
                    descr += `- **IMDb**: [链接](${imdb_link})\n`;
                }
            }
            if (douban_rating || douban_link) {
                if (douban_rating) {
                    descr += `- **豆瓣**: ${douban_rating}`;
                    if (douban_link) descr += ` ([链接](${douban_link}))`;
                    descr += `\n`;
                } else {
                    descr += `- **豆瓣**: [链接](${douban_link})\n`;
                }
            }
            if (tmdb_rating || tmdb_link) {
                if (tmdb_rating) {
                    descr += `- **TMDB**: ${tmdb_rating}`;
                    if (tmdb_link) descr += ` ([链接](${tmdb_link}))`;
                    descr += `\n`;
                } else {
                    descr += `- **TMDB**: [链接](${tmdb_link})\n`;
                }
            }
            if (bangumi_rating || bangumi_link) {
                if (bangumi_rating) {
                    descr += `- **Bangumi**: ${bangumi_rating}`;
                    if (bangumi_link) descr += ` ([链接](${bangumi_link}))`;
                    descr += `\n`;
                } else {
                    descr += `- **Bangumi**: [链接](${bangumi_link})\n`;
                }
            }
        }

        if (director.length > 0 || writer.length > 0 || cast.length > 0) {
            descr += `\n## 制作人员\n\n`;
            descr += director.length > 0 ? `- **导演**: ${director.join(' / ')}\n` : '';
            descr += writer.length > 0 ? `- **编剧**: ${writer.join(' / ')}\n` : '';
            descr += cast.length > 0 ? `- **主演**: ${cast.slice(0, 10).join(' / ')}\n` : '';

            if (data.extras?.staff && data.extras?.staff.length > 0) {
                const otherStaff = data.extras.staff.filter((s: string) =>
                    !s.includes("监督") && !s.includes("导演") &&
                    !s.includes("脚本") && !s.includes("系列构成")
                ).slice(0, 10);
                if (otherStaff.length > 0) {
                    descr += `- **其他制作人员**: ${otherStaff.join(' / ')}\n`;
                }
            }
        }

        descr += tags.length > 0 ? `\n## 标签\n\n${tags.join(' | ')}\n` : '';
        descr += introduction ? `\n## 简介\n\n${introduction}\n` : '';
        descr += awards ? `\n## 获奖情况\n\n${awards}\n` : '';

        if (bangumi_link) {
            descr += `\n> 来源于 [Bangumi](${bangumi_link})\n`;
        }

        return descr.trim();
    }

    private formatGame(data: MediaInfo): string {
        const poster = String(data?.poster || '');
        const title = data.chinese_title || data.foreign_title;
        const gameInfo = data.game_info || {};
        const extra = (data.extras || data.extra || {}) as MediaExtras;

        let descr = poster ? `![海报](${poster})\n\n` : '';

        // Header Image (Steam) - logic mirrored from BBCode but using Markdown image
        if (data.site === 'steam' && data.id) {
            const headerImg = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${data.id}/header.jpg`;
            descr += `![Header](${headerImg})\n\n`;
        }

        descr += `## 基本信息\n\n`;
        if (title) descr += `- **名称**: ${title}\n`;
        if (data.foreign_title && data.foreign_title !== title) {
            descr += `- **英文名称**: ${data.foreign_title}\n`;
        }

        // Use structured data primarily for Markdown to be cleaner
        if (gameInfo.developer?.length) descr += `- **开发商**: ${gameInfo.developer.join(' / ')}\n`;
        if (gameInfo.publisher?.length) descr += `- **发行商**: ${gameInfo.publisher.join(' / ')}\n`;
        if (data.year) descr += `- **发行日期**: ${data.playdate?.[0] || data.year}\n`;

        if (gameInfo.platform?.length) descr += `- **平台**: ${gameInfo.platform.join(' / ')}\n`;
        if (data.genre?.length) descr += `- **类型**: ${data.genre.join(' / ')}\n`;
        if (gameInfo.price?.length) descr += `- **售价**: ${gameInfo.price.join(' / ')}\n`;
        if (extra.rate_stars) descr += `- **评分**: ${extra.rate_stars} / 5.0 (${extra.rate_count || 0} 人评)\n`;

        // Links
        if (gameInfo.links) {
            const links = [];
            if (gameInfo.links.linkbar) links.push(`[官方网站](${gameInfo.links.linkbar})`);
            if (gameInfo.links.steam) links.push(`[Steam](${gameInfo.links.steam})`);
            if (gameInfo.links.indienova) links.push(`[Indienova](${gameInfo.links.indienova})`);
            if (gameInfo.links.gog) links.push(`[GOG](${gameInfo.links.gog})`);

            if (links.length > 0) {
                descr += `- **链接**: ${links.join(' | ')}\n`;
            }
        }

        // Languages
        if (gameInfo.ui_lang?.length || gameInfo.audio_lang?.length || extra.languages?.length) {
            descr += `- **语言**:\n`;
            if (gameInfo.ui_lang?.length) descr += `  - **界面/字幕**: ${gameInfo.ui_lang.join("、")}\n`;
            if (gameInfo.audio_lang?.length) descr += `  - **音频**: ${gameInfo.audio_lang.join("、")}\n`;

            if (!gameInfo.ui_lang?.length && !gameInfo.audio_lang?.length) {
                const simpleLangs = extra.languages || data.language || [];
                if (simpleLangs.length > 0) descr += `  - ${simpleLangs.join("、")}\n`;
            }
        }

        descr += "\n## 游戏简介\n\n";
        const intro = data.introduction || extra.intro || '';
        if (intro) descr += `${intro}\n\n`;

        // Installation Info
        descr += "## 安装信息\n\n";
        descr += "1. 解压缩\n";
        descr += "2. 载入镜像\n";
        descr += "3. 安装游戏\n";
        descr += "4. 复制Crack文件夹下的未加密补丁到游戏目录覆盖\n";
        descr += "5. 运行游戏\n\n";

        // System Requirements
        if (extra.sysreq || extra.system_requirements) {
            const sys = extra.sysreq ?? extra.system_requirements;
            descr += "## 配置需求\n\n";

            if (Array.isArray(sys)) {
                sys.forEach(s => descr += `- ${s}\n`);
            } else if (sys && typeof sys === 'object') {
                for (let [osName, osData] of Object.entries(sys as Record<string, any>)) {
                    let osDisplayName = osName === "windows" ? "Windows" :
                        osName === "osx" ? "Mac OS X" :
                            osName === "linux" ? "Linux" : osName;

                    descr += `### ${osDisplayName}\n\n`;
                    let reqs = osData.requirements || {};
                    // Minimum
                    if (reqs.minimum) {
                        descr += "**最低配置**:\n";
                        for (let [reqId, reqDesc] of Object.entries(reqs.minimum) as any) {
                            descr += `- **${reqId}**: ${reqDesc}\n`;
                        }
                        descr += "\n";
                    }
                    // Recommended
                    if (reqs.recommended) {
                        descr += "**推荐配置**:\n";
                        for (let [reqId, reqDesc] of Object.entries(reqs.recommended) as any) {
                            descr += `- **${reqId}**: ${reqDesc}\n`;
                        }
                        descr += "\n";
                    }
                }
            }
        }

        // Screenshots
        const infoMap = extra.info_map as Record<string, unknown> | undefined;
        const infoMapScreenshots = infoMap && Array.isArray((infoMap as any).screenshots) ? (infoMap as any).screenshots : undefined;
        const screenshots = data.screenshots || extra.screenshots || infoMapScreenshots;
        if (Array.isArray(screenshots) && screenshots.length > 0) {
            descr += "## 游戏截图\n\n";
            descr += screenshots.map((x: string) => `![](${x})`).join("\n") + "\n\n";
        }

        return descr.trim();
    }
}
