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

        let title = apiJson.title || '';
        let releaseDate = apiJson.releaseDate || '';
        let languages: string[] = Object.values(apiJson.languages || {});
        let cover = '';
        let descr = '';
        let devs: string[] = [];
        let pubs: string[] = [];
        let price: string | null = null;
        let screenshots: string[] = [];
        let systemRequirements: any = {};
        let platforms: string[] = [];
        const tags: string[] = [];

        // Parse HTML (Poster, Description, System Reqs, Screenshots)
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
                        cover = cardProduct.boxArtImage;
                    }

                    // Screenshots
                    if (cardProduct.screenshots && cardProduct.screenshots.length > 0) {
                        screenshots = cardProduct.screenshots.map((s: any) => {
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

                        systemRequirements[osName] = {
                            versions: osVer,
                            requirements: {}
                        };

                        for (const reqGroup of sysReqs) {
                            const reqType = reqGroup.type;
                            const reqs = reqGroup.requirements || [];
                            if (!reqType || reqs.length === 0) continue;

                            systemRequirements[osName].requirements[reqType] = {};
                            reqs.forEach((r: any) => {
                                if (r.id && r.description) {
                                    systemRequirements[osName].requirements[reqType][r.id] = r.description;
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
        const platformsData = apiJson.content_system_compatibility || {};
        if (platformsData.windows) platforms.push("Windows");
        if (platformsData.osx) platforms.push("Mac OS X");
        if (platformsData.linux) platforms.push("Linux");

        // Description
        const descHtml = apiJson.description?.full || apiJson.description?.lead || "";
        if (descHtml) {
            let descrBbcode = html2bbcode(descHtml);
            descrBbcode = descrBbcode
                .replace(/\[img\][\s\S]*?\[\/img\]/ig, "")
                .replace(/\[h2\][\s\S]*?\[\/h2\]/ig, "")
                .replace(/\[hr\]/ig, "");

            descr = descrBbcode.split("\n").map(x => x.trim()).filter(x => x.length > 0).join("\n").trim();
        }

        return {
            site: 'gog',
            id: data.sid,
            title: title || '',
            original_title: title || '',
            chinese_title: '',
            foreign_title: title || '',
            aka: [],
            trans_title: [],
            this_title: [title || ''],

            year: releaseDate ? releaseDate.match(/\d{4}/)?.[0] || '' : '',
            playdate: releaseDate ? [releaseDate] : [],
            region: [],
            genre: tags,
            language: languages,
            duration: '',
            episodes: '',
            seasons: '',

            poster: cover,

            director: devs,
            writer: pubs,
            cast: [],

            introduction: descr,
            awards: '',
            tags: tags,

            screenshots: screenshots,

            game_info: {
                platform: platforms,
                developer: devs,
                publisher: pubs,
                links: {
                    gog: `https://www.gog.com${data.url || ''}`
                },
                price: price ? [price] : [],
                spec: systemRequirements
            },

            extra: {
                sysreq: systemRequirements,
                price: price
            }
        };
    }
}
