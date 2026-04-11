import { Context } from 'hono';
import { AppError, ErrorCode } from '../../lib/errors';

export interface RequestParams {
  url?: string;
  site?: string;
  sid?: string;
  format: string;
}

/**
 * 从 Hono Context 中提取请求参数
 * 契约：
 * 1. `/api/v2/info/:site/:sid` 中路径参数唯一决定资源，body/query 仅补充 format。
 * 2. `/api/v2/info` 中 POST body 优先于 query；若最终存在 url，则忽略 site/sid。
 */
export async function extractRequestParams(c: Context): Promise<RequestParams> {
  const query = {
    url: c.req.query('url'),
    site: c.req.query('site'),
    sid: c.req.query('sid'),
    format: c.req.query('format') || 'json',
  };

  const body = c.req.method === 'POST' ? await parseJsonBody(c) : {};
  const bodyFormat = typeof body?.format === 'string' ? body.format : undefined;
  const format = bodyFormat || query.format;

  const pathSite = c.req.param('site');
  const pathSid = c.req.param('sid');
  const hasPathResource = Boolean(pathSite || pathSid);

  if (hasPathResource) {
    return {
      site: pathSite || undefined,
      sid: pathSid || undefined,
      format,
    };
  }

  const bodyUrl = typeof body?.url === 'string' ? body.url : undefined;
  const url = bodyUrl || query.url;
  if (url) {
    return {
      url,
      format,
    };
  }

  return {
    site: typeof body?.site === 'string' ? body.site : query.site,
    sid: typeof body?.sid === 'string' ? body.sid : query.sid,
    format,
  };
}

/**
 * 解析 POST JSON body，支持容错处理
 */
async function parseJsonBody(c: Context): Promise<any> {
  const contentType = (c.req.header('content-type') || '').toLowerCase();

  let rawBody = '';
  try {
    rawBody = await c.req.text();
  } catch {
    return {};
  }

  const trimmed = rawBody.trim();
  if (!trimmed) return {};

  // 判断是否应该尝试解析为 JSON
  const declaredJson = contentType.includes('application/json') || contentType.includes('+json');
  const looksLikeJson = /^[\s]*[{\[]/.test(trimmed);

  if (!declaredJson && !looksLikeJson) {
    // 不是 JSON，静默忽略
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new AppError(ErrorCode.INVALID_PARAM, 'Invalid JSON body');
  }
}
