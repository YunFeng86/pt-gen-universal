import { Context } from 'hono';
import { Orchestrator } from '../../lib/orchestrator';
import { AppConfig } from '../../lib/types/config';
import { AppError, ErrorCode } from '../../lib/errors';
import { API_VERSION, SCHEMA_VERSION, PARSER_VERSION, SOURCE_FINGERPRINTS } from '../../lib/constants/version';
import { ApiV2SuccessResponse } from '../../lib/types/api_v2';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import { MarkdownFormatter } from '../../lib/formatters/markdown';
import { NONE_EXIST_ERROR } from '../../lib/utils/error';
import { matchUrl } from '../../lib/utils/url';

export class V2Controller {
    private bbcodeFormatter: BBCodeFormatter;
    private markdownFormatter: MarkdownFormatter;

    constructor(private orchestrator: Orchestrator, private config: AppConfig) {
        this.bbcodeFormatter = new BBCodeFormatter();
        this.markdownFormatter = new MarkdownFormatter();
    }

    async handleInfo(c: Context) {
        // Default to JSON for API v2. (Older code defaulted to bbcode; that conflicted with README.)
        let format = 'json';

        // Query params are always available (GET and POST).
        const queryUrl = c.req.query('url');
        const querySite = c.req.query('site');
        const querySid = c.req.query('sid');
        const queryFormat = c.req.query('format');
        if (queryFormat) format = queryFormat;

        // RESTful path params (if route matches /api/v2/info/:site/:sid)
        const pathSite = c.req.param('site');
        const pathSid = c.req.param('sid');

        // POST JSON body (highest priority for url/site/sid; format can override query)
        let bodyUrl: string | undefined;
        let bodySite: string | undefined;
        let bodySid: string | undefined;
        if (c.req.method === 'POST') {
            try {
                const body = await c.req.json();
                if (typeof body?.url === 'string') bodyUrl = body.url;
                if (typeof body?.site === 'string') bodySite = body.site;
                if (typeof body?.sid === 'string') bodySid = body.sid;
                if (typeof body?.format === 'string') format = body.format;
            } catch {
                throw new AppError(ErrorCode.INVALID_PARAM, 'Invalid JSON body');
            }
        }

        // Resolve effective input. Precedence: body > path > query for site/sid; body > query for url.
        let url: string | undefined = bodyUrl ?? queryUrl;
        let site: string | undefined = bodySite ?? pathSite ?? querySite;
        let sid: string | undefined = bodySid ?? pathSid ?? querySid;

        // Validation
        if (!url && (!site || !sid)) {
            throw new AppError(ErrorCode.INVALID_PARAM, "Missing 'url' or 'site/sid' parameters");
        }

        try {
            // Resolve Site/SID if URL is provided
            if (url) {
                const parsed = this.parseUrl(url);
                site = parsed.site;
                sid = parsed.sid;
            }

            // At this point, site and sid MUST be defined
            if (!site || !sid) {
                throw new AppError(ErrorCode.INVALID_PARAM, "Could not resolve site/sid");
            }

            const info = await this.orchestrator.getMediaInfo(site, sid);

            // Generate format output if requested
            const validFormat = typeof format === 'string' ? format.toLowerCase() : 'bbcode';
            let formatOutput: string | undefined;

            if (validFormat === 'bbcode' || validFormat === 'markdown') {
                if (validFormat === 'bbcode') {
                    formatOutput = this.bbcodeFormatter.format(info);
                } else {
                    formatOutput = this.markdownFormatter.format(info);
                }
            }

            const response: ApiV2SuccessResponse = {
                versions: {
                    schema: SCHEMA_VERSION,
                    parser: PARSER_VERSION,
                    source_fingerprint: SOURCE_FINGERPRINTS[site] || 'unknown'
                },
                meta: {
                    api_version: API_VERSION,
                    generated_at_ms: Date.now(),
                    source_url: url,
                },
                data: {
                    ...info,
                    format: formatOutput // Will be undefined if format=json
                }
            };

            return c.json(response);
        } catch (e: any) {
            // Rethrow AppErrors, wrap others
            if (e instanceof AppError) throw e;

            const message = typeof e?.message === 'string' ? e.message : 'Unknown error';
            throw this.mapError(message);
        }
    }

    async handleSearch(c: Context) {
        if (this.config.disableSearch) {
            throw new AppError(ErrorCode.FEATURE_DISABLED, 'search disabled');
        }

        const query = c.req.query('q');
        const source = c.req.query('source') || 'douban';

        if (!query) {
            throw new AppError(ErrorCode.INVALID_PARAM, "Missing 'q' parameter");
        }

        try {
            const results = await this.orchestrator.search(source, query);

            const response: ApiV2SuccessResponse = {
                versions: {
                    schema: SCHEMA_VERSION,
                    parser: PARSER_VERSION,
                    source_fingerprint: SOURCE_FINGERPRINTS[source] || 'unknown'
                },
                meta: {
                    api_version: API_VERSION,
                    generated_at_ms: Date.now(),
                    // source_url: N/A
                },
                data: results
            };
            return c.json(response);

        } catch (e: any) {
            if (e instanceof AppError) throw e;
            const message = typeof e?.message === 'string' ? e.message : 'Unknown error';
            throw this.mapError(message);
        }
    }

    private parseUrl(url: string): { site: string, sid: string } {
        return matchUrl(url);
    }

    private mapError(message: string): AppError {
        const normalized = message.toLowerCase();

        // Invalid/unsupported sources should be treated as client errors.
        if (
            normalized.includes('scraper not found:') ||
            normalized.includes('normalizer not found:') ||
            normalized.includes('formatter not found:')
        ) {
            return new AppError(ErrorCode.INVALID_PARAM, message);
        }

        if (message === NONE_EXIST_ERROR || normalized.includes('not found')) {
            return new AppError(ErrorCode.TARGET_NOT_FOUND, message);
        }
        if (normalized.includes('timeout')) {
            return new AppError(ErrorCode.TARGET_TIMEOUT, message);
        }
        if (
            normalized.includes('sec.douban.com') ||
            normalized.includes('anti-bot') ||
            normalized.includes('captcha')
        ) {
            return new AppError(ErrorCode.TARGET_BLOCKING, message);
        }

        return new AppError(ErrorCode.INTERNAL_ERROR, message);
    }
}
