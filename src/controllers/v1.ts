import { Context } from 'hono';
import { Orchestrator } from '../../lib/orchestrator';
import { AppConfig } from '../../lib/types/config';
import { AUTHOR, VERSION } from '../../lib/const';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import { MarkdownFormatter } from '../../lib/formatters/markdown';
import debug_get_err from '../../lib/utils/error';

export class V1Controller {
    private bbcodeFormatter: BBCodeFormatter;
    private markdownFormatter: MarkdownFormatter;

    constructor(private orchestrator: Orchestrator, private config: AppConfig) {
        this.bbcodeFormatter = new BBCodeFormatter();
        this.markdownFormatter = new MarkdownFormatter();
    }

    async handleSearch(c: Context) {
        if (this.config.disableSearch) {
            return c.json({ error: 'this ptgen disallow search' }, 403);
        }

        const keywords = c.req.query('q') || c.req.query('search');
        const source = c.req.query('source') || 'douban';

        if (!keywords) {
            return c.json({ error: 'Missing query parameter: q or search' }, 400);
        }

        try {
            const data = await this.orchestrator.search(source, keywords);
            const compatibleData = {
                data: data.map(item => ({
                    year: item.year,
                    subtype: item.type,
                    title: item.title,
                    subtitle: item.subtitle,
                    link: item.link,
                    id: item.id,
                    img: item.poster
                }))
            };
            return c.json(this.makeJsonResponseData(compatibleData));
        } catch (e: any) {
            return this.handleError(c, e);
        }
    }

    async handleInfo(c: Context) {
        const site = c.req.param('site');
        const sid = c.req.param('sid');
        const url = c.req.query('url');

        if (url) {
            // URL mode
            try {
                const { site: matchedSite, sid: matchedSid } = this.matchUrl(url);
                return this.processInfo(c, matchedSite, matchedSid);
            } catch (e: any) {
                // V1 returns 400 for unsupported URL
                return c.json({ error: 'Unsupported URL or input unsupported resource url' }, 400);
            }
        }

        if (site && sid) {
            return this.processInfo(c, site, sid);
        }

        return c.json({ error: 'Missing url or site/sid' }, 400);
    }

    private async processInfo(c: Context, site: string, sid: string) {
        try {
            const info = await this.orchestrator.getMediaInfo(site, sid);
            const bbcode = this.bbcodeFormatter.format(info);
            const markdown = this.markdownFormatter.format(info);

            const data = {
                sid: sid,
                success: true,
                ...info,
                format: bbcode,
                formats: {
                    bbcode: bbcode,
                    markdown: markdown,
                    json: JSON.stringify(info, null, 2)
                },
                link: info.link || ``
            };
            return c.json(this.makeJsonResponseData(data));
        } catch (e: any) {
            return this.handleError(c, e);
        }
    }

    private handleError(c: Context, e: any) {
        const debug = c.req.query('debug') === '1';
        const err_return: any = {
            error: `Internal Error, Please contact @${AUTHOR}. Exception: ${e.message}`
        };

        if (debug) {
            err_return['debug'] = debug_get_err(e, c.req.raw);
        }

        // V1 usually returns 500 for errors, but wrapper goal says "200 OK" is sometimes used by legacy clients?
        // Wait, app.ts analysis showed: return c.json(makeJsonResponseData(err_return), 500)
        // So I should keep 500.
        // User request said: "Mimicry... V1 Interface... mimic legacy behavior".
        // "V1 Adapter logic... Returns 200 OK even for errors. Structure: { success: false, error: ... }"
        // BUT current app.ts returns 500.
        // User said: "V1 Old version compatibility... Mimicry... Original project habits: Error returns HTTP 200... JSON { success: false, msg: ... }"
        // BUT my analysis of app.ts showed `return c.json(..., 500)`.
        // Line 290: `return c.json(makeJsonResponseData(err_return), 500)`
        // So the *current* code outputs 500.
        // If the user wants to mimic *legacy* behavior (before my refactor?), maybe they believe it was 200?
        // OR maybe "Original Project" refer to the Python version or previous versions?
        // User request: "V1 adapter logic... Returns 200 OK". 
        // I should probably follow the USER instruction to return 200 if they explicitly asked for it in the prompt ("V1 Adapter logic: Returns 200 OK even for errors").
        // Wait, the prompt said: "Simulate Scenario: Original project returns HTTP 200... New kernel throws 502... V1 adapter logic: return jsonify(...), 200".
        // It was an *example*? "Scene simulation".
        // "For V1 interface, principle is only one: Mimic original project error behavior".
        // If original project (current app.ts) returns 500, I should return 500.
        // Checking app.ts line 290 again. `return c.json(..., 500)`.
        // So I will return 500 to invoke exact behavior of app.ts.
        return c.json(this.makeJsonResponseData(err_return), 500);
    }

    private makeJsonResponseData(body_update: any) {
        return {
            success: !body_update.error,
            error: body_update.error || null,
            format: body_update.format || '',
            copyright: `Powered by @${AUTHOR}`,
            version: VERSION,
            generate_at: Date.now(),
            ...body_update
        };
    }

    private matchUrl(url: string): { site: string, sid: string } {
        const support_list: Record<string, RegExp> = {
            "douban": /(?:https?:\/\/)?(?:(?:movie|www|m)\.)?douban\.com\/(?:(?:movie\/)?subject|movie)\/(\d+)\/?/,
            "imdb": /(?:https?:\/\/)?(?:www\.)?imdb\.com\/title\/(tt\d+)\/?/,
            "bangumi": /(?:https?:\/\/)?(?:bgm\.tv|bangumi\.tv|chii\.in)\/subject\/(\d+)\/?/,
            "steam": /(?:https?:\/\/)?(?:store\.)?steam(?:powered|community)\.com\/app\/(\d+)\/?/,
            "indienova": /(?:https?:\/\/)?indienova\.com\/(?:game|g)\/(\S+)/,
            "gog": /(?:https?:\/\/)?(?:www\.)?gog\.com\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?game\/([\w-]+)/,
            "tmdb": /(?:https?:\/\/)?(?:www\.)?themoviedb\.org\/(?:(movie|tv))\/(\d+)\/?/
        };

        for (const [site, pattern] of Object.entries(support_list)) {
            const match = url.match(pattern);
            if (match) {
                const sid = site === 'tmdb'
                    ? `${match[1]}-${match[2]}`
                    : match[1];
                return { site, sid };
            }
        }
        throw new Error("No match");
    }
}
