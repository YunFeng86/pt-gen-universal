import { Context } from 'hono';
import { Orchestrator } from '../../lib/orchestrator';
import { AppConfig } from '../../lib/types/config';
import { AppError, ErrorCode } from '../../lib/errors';
import { API_VERSION, SCHEMA_VERSION, PARSER_VERSION, SOURCE_FINGERPRINTS } from '../../lib/constants/version';
import { ApiV2SuccessResponse } from '../../lib/types/api_v2';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import { MarkdownFormatter } from '../../lib/formatters/markdown';
import { matchUrl } from '../../lib/utils/url';
import { toAppError } from '../../lib/utils/app-error';

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

        // POST body (highest priority for url/site/sid; format can override query)
        let bodyUrl: string | undefined;
        let bodySite: string | undefined;
        let bodySid: string | undefined;
        if (c.req.method === 'POST') {
            // Hono/Request will throw on empty body if we call c.req.json() unconditionally.
            // Allow POST with only query params; only treat it as "invalid JSON" when a non-empty
            // body looks like JSON but can't be parsed.
            const contentType = c.req.header('content-type') || '';
            let rawBody = '';
            try {
                rawBody = await c.req.text();
            } catch {
                rawBody = '';
            }

            const trimmed = rawBody.trim();
            if (trimmed) {
                const ct = contentType.toLowerCase();
                const declaredJson = ct.includes('application/json') || ct.includes('+json');
                const looksLikeJson = /^[\s]*[{\[]/.test(rawBody);

                if (declaredJson || looksLikeJson || ct === '') {
                    try {
                        const body = JSON.parse(rawBody);
                        if (typeof body?.url === 'string') bodyUrl = body.url;
                        if (typeof body?.site === 'string') bodySite = body.site;
                        if (typeof body?.sid === 'string') bodySid = body.sid;
                        if (typeof body?.format === 'string') format = body.format;
                    } catch {
                        throw new AppError(ErrorCode.INVALID_PARAM, 'Invalid JSON body');
                    }
                }
            }
        }

        const normalizedFormat = String(format).trim().toLowerCase();
        const allowedFormats = new Set(['json', 'bbcode', 'markdown']);
        if (!allowedFormats.has(normalizedFormat)) {
            throw new AppError(ErrorCode.INVALID_PARAM, "Invalid 'format' parameter");
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
            let formatOutput: string | undefined;

            if (normalizedFormat === 'bbcode' || normalizedFormat === 'markdown') {
                if (normalizedFormat === 'bbcode') {
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
            throw toAppError(e);
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
            throw toAppError(e);
        }
    }

    private parseUrl(url: string): { site: string, sid: string } {
        return matchUrl(url);
    }
}
