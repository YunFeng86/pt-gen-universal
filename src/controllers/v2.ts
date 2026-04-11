import { Context } from 'hono';
import { Orchestrator } from '../../lib/orchestrator';
import { AppConfig } from '../../lib/types/config';
import { AppError, ErrorCode } from '../../lib/errors';
import {
  API_VERSION,
  SCHEMA_VERSION,
  PARSER_VERSION,
  SOURCE_FINGERPRINTS,
} from '../../lib/constants/version';
import { ApiV2SuccessResponse } from '../../lib/types/api_v2';
import { toAppError } from '../../lib/utils/app-error';
import { CTX_CACHEABLE } from '../utils/context';
import { MediaInfoService, type MediaInfoFormat } from '../services/media-info';
import { extractRequestParams } from '../utils/request-params';

export class V2Controller {
  constructor(
    private readonly orchestrator: Orchestrator,
    private readonly mediaInfoService: MediaInfoService,
    private readonly config: AppConfig
  ) {}

  async handleInfo(c: Context) {
    try {
      // 提取参数（统一处理 query/path/body，支持优先级）
      const { url, site, sid, format } = await extractRequestParams(c);

      // 验证格式参数
      const normalizedFormat = format.trim().toLowerCase() as MediaInfoFormat;
      const allowedFormats = new Set(['json', 'bbcode', 'markdown']);
      if (!allowedFormats.has(normalizedFormat)) {
        throw new AppError(ErrorCode.INVALID_PARAM, "Invalid 'format' parameter");
      }

      const { site: finalSite, info } = await this.mediaInfoService.resolve({ url, site, sid });
      const formatOutput = this.mediaInfoService.renderFormat(info, normalizedFormat);

      const response: ApiV2SuccessResponse = {
        versions: {
          schema: SCHEMA_VERSION,
          parser: PARSER_VERSION,
          source_fingerprint: SOURCE_FINGERPRINTS[finalSite] || 'unknown',
        },
        meta: {
          api_version: API_VERSION,
          generated_at_ms: Date.now(),
          source_url: url,
        },
        data: {
          ...info,
          format: formatOutput,
        },
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
          source_fingerprint: SOURCE_FINGERPRINTS[source] || 'unknown',
        },
        meta: {
          api_version: API_VERSION,
          generated_at_ms: Date.now(),
          // source_url: N/A
        },
        data: results,
      };
      c.set(CTX_CACHEABLE, true);
      return c.json(response);
    } catch (e: any) {
      throw toAppError(e);
    }
  }
}
