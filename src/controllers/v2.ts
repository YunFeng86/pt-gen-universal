import { Context } from 'hono';
import { Orchestrator } from '../../lib/orchestrator';
import { AppConfig } from '../../lib/types/config';
import { AppError, ErrorCode } from '../../lib/errors';
import { API_VERSION, SCHEMA_VERSION, PARSER_VERSION, SOURCE_FINGERPRINTS } from '../../lib/constants/version';
import { ApiV2SuccessResponse } from '../../lib/types/api_v2';
import { BBCodeFormatter } from '../../lib/formatters/bbcode';
import { MarkdownFormatter } from '../../lib/formatters/markdown';
import { toAppError } from '../../lib/utils/app-error';
import { CTX_CACHEABLE } from '../utils/context';
import { extractRequestParams } from '../utils/request-params';

export class V2Controller {
    private bbcodeFormatter: BBCodeFormatter;
    private markdownFormatter: MarkdownFormatter;

    constructor(private orchestrator: Orchestrator, private config: AppConfig) {
        this.bbcodeFormatter = new BBCodeFormatter();
        this.markdownFormatter = new MarkdownFormatter();
    }

    async handleInfo(c: Context) {
        try {
            // 提取参数（统一处理 query/path/body，支持优先级）
            const { url, site, sid, format } = await extractRequestParams(c);

            // 验证格式参数
            const normalizedFormat = format.trim().toLowerCase();
            const allowedFormats = new Set(['json', 'bbcode', 'markdown']);
            if (!allowedFormats.has(normalizedFormat)) {
                throw new AppError(ErrorCode.INVALID_PARAM, "Invalid 'format' parameter");
            }

            // 验证必需参数
            if (!url && (!site || !sid)) {
                throw new AppError(ErrorCode.INVALID_PARAM, "Missing 'url' or 'site/sid' parameters");
            }

            // 解析 URL 或直接使用 site/sid
            let finalSite = site;
            let finalSid = sid;
            if (url) {
                const parsed = this.orchestrator.matchUrl(url);
                finalSite = parsed.site;
                finalSid = parsed.sid;
            }

            if (!finalSite || !finalSid) {
                throw new AppError(ErrorCode.INVALID_PARAM, "Could not resolve site/sid");
            }

            // 获取媒体信息
            const info = await this.orchestrator.getMediaInfo(finalSite, finalSid);

            // 生成格式化输出
            let formatOutput: string | undefined;
            if (normalizedFormat === 'bbcode') {
                formatOutput = this.bbcodeFormatter.format(info);
            } else if (normalizedFormat === 'markdown') {
                formatOutput = this.markdownFormatter.format(info);
            }

            const response: ApiV2SuccessResponse = {
                versions: {
                    schema: SCHEMA_VERSION,
                    parser: PARSER_VERSION,
                    source_fingerprint: SOURCE_FINGERPRINTS[finalSite] || 'unknown'
                },
                meta: {
                    api_version: API_VERSION,
                    generated_at_ms: Date.now(),
                    source_url: url,
                },
                data: {
                    ...info,
                    format: formatOutput
                }
            };

            c.set(CTX_CACHEABLE, true);
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
            c.set(CTX_CACHEABLE, true)
            return c.json(response);

        } catch (e: any) {
            throw toAppError(e);
        }
    }

    private parseUrl(url: string): { site: string, sid: string } {
        return this.orchestrator.matchUrl(url);
    }
}
