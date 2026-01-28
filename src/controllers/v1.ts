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
                const { site: matchedSite, sid: matchedSid } = this.orchestrator.matchUrl(url);
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
        const debug = this.config.enableDebug === true && c.req.query('debug') === '1';
        const err_return: any = {
            error: `Internal Error, Please contact @${AUTHOR}. Exception: ${e.message}`
        };

        if (debug) {
            err_return['debug'] = debug_get_err(e, c.req.raw);
        }

        // Keep legacy-ish shape; return 500 for errors.
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

}
