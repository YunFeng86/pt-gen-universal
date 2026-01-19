
import { Normalizer } from '../interfaces/normalizer';
import { GogRawData } from '../types/raw-data';
import { MediaInfo } from '../types/schema';
import { AppConfig } from '../types/config';
import { html2bbcode } from '../utils/legacy-utils';
import { GAME_INSTALL_TEMPLATE } from '../utils/legacy-utils';

export class GogNormalizer implements Normalizer {
    normalize(rawData: GogRawData, config: AppConfig): MediaInfo {
        const data = rawData;
        const apiJson = data.api_data || {};
        const html = data.store_page_html || '';

        const info: MediaInfo = {
            site: 'gog',
            id: data.sid,
            title: apiJson.title || '',
            original_title: apiJson.title || '',
            chinese_title: '',
            foreign_title: '',
            aka: [],
            trans_title: [],
            this_title: [apiJson.title || ''],
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
            extra: {
                gog_id: data.gog_id,
                slug: apiJson.slug,
                platforms: [],
                languages: [],
                system_requirements: {},
                screenshots: []
            }
        };

        // Parse HTML (System Reqs, Screenshots, Poster)
        if (html) {
            let cardMatch = html.match(/cardProduct:\s*(\{[\s\S]*?\})\s*(?:,\s*\w+:|$)/);
            if (!cardMatch) {
                cardMatch = html.match(/cardProduct:\s*(\{[\s\S]*?\n\s*\})/);
            }

            if (cardMatch) {
                try {
                    const cardProduct = JSON.parse(cardMatch[1]);

                    // Poster
                    if (cardProduct.boxArtImage) {
                        info.poster = cardProduct.boxArtImage;
                    }

                    // Screenshots
                    if (cardProduct.screenshots && cardProduct.screenshots.length > 0) {
                        info.extra.screenshots = cardProduct.screenshots.map((s: any) => {
                            let url = s.imageUrl || s;
                            if (!url.startsWith('http')) url = `https:${url}`;
                            if (!url.includes('_ggvgl')) url = `${url}_ggvgl_2x.jpg`;
                            return url;
                        });
                    }

                    // System Reqs
                    const supportedOs = cardProduct.supportedOperatingSystems || [];
                    for (const osInfo of supportedOs) {
                        const osName = osInfo.operatingSystem?.name;
                        const osVer = osInfo.operatingSystem?.versions;
                        const sysReqs = osInfo.systemRequirements || [];

                        if (!osName || sysReqs.length === 0) continue;

                        info.extra.system_requirements[osName] = {
                            versions: osVer,
                            requirements: {}
                        };

                        for (const reqGroup of sysReqs) {
                            const reqType = reqGroup.type;
                            const reqs = reqGroup.requirements || [];
                            if (!reqType || reqs.length === 0) continue;

                            info.extra.system_requirements[osName].requirements[reqType] = {};
                            reqs.forEach((r: any) => {
                                if (r.id && r.description) {
                                    info.extra.system_requirements[osName].requirements[reqType][r.id] = r.description;
                                }
                            });
                        }
                    }

                } catch (e) {
                    console.error('Failed to parse cardProduct json', e);
                }
            }
        }

        // Platforms
        const platforms = apiJson.content_system_compatibility || {};
        if (platforms.windows) info.extra.platforms.push("Windows");
        if (platforms.osx) info.extra.platforms.push("Mac OS X");
        if (platforms.linux) info.extra.platforms.push("Linux");

        // Languages
        const langs = apiJson.languages || {};
        info.extra.languages = Object.values(langs);

        // Description
        const descHtml = apiJson.description?.full || apiJson.description?.lead || "";
        let cleanDescr = "";
        if (descHtml) {
            let descrBbcode = html2bbcode(descHtml);
            descrBbcode = descrBbcode
                .replace(/\[img\][\s\S]*?\[\/img\]/ig, "")
                .replace(/\[h2\][\s\S]*?\[\/h2\]/ig, "")
                .replace(/\[hr\]/ig, "");

            cleanDescr = descrBbcode.split("\n").map(x => x.trim()).filter(x => x.length > 0).join("\n").trim();
            info.introduction = cleanDescr;
        }

        // ------------------------
        // Construct Full BBCode (Legacy Logic)
        // ------------------------
        let descr = info.poster ? `[img]${info.poster}[/img]\n\n` : '';

        descr += "【基本信息】\n\n";
        if (info.title) descr += `名称: ${info.title}\n`;
        if (info.extra.platforms.length > 0) descr += `平台: ${info.extra.platforms.join("、")}\n`;
        if (data.gog_id) {
            const gogLink = `https://www.gog.com/game/${apiJson.slug || data.gog_id}`;
            descr += `GOG页面: ${gogLink}\n`;
        }
        if (info.extra.languages.length > 0) descr += `游戏语种: ${info.extra.languages.join("、")}\n`;

        descr += "\n【游戏简介】\n\n";
        if (cleanDescr) descr += `${cleanDescr}\n\n`;

        // System Requirements
        if (Object.keys(info.extra.system_requirements).length > 0) {
            descr += "【系统需求】\n\n";

            for (let [osName, osData] of Object.entries(info.extra.system_requirements) as any) {
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

        descr += GAME_INSTALL_TEMPLATE + "\n\n";

        if (info.extra.screenshots.length > 0) {
            descr += "【游戏截图】\n\n";
            descr += info.extra.screenshots.map((x: string) => `[img]${x}[/img]`).join("\n") + "\n\n";
        }

        info.extra.descr_bbcode = descr.trim();

        return info;
    }
}
