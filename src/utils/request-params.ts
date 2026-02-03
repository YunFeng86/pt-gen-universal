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
 * 优先级：POST body > RESTful path > Query params
 */
export async function extractRequestParams(c: Context): Promise<RequestParams> {
    const params: RequestParams = { format: 'json' };

    // 1. 基础层：Query params（最低优先级）
    params.url = c.req.query('url');
    params.site = c.req.query('site');
    params.sid = c.req.query('sid');
    params.format = c.req.query('format') || 'json';

    // 2. RESTful 层：Path params（中等优先级，覆盖 site/sid）
    const pathSite = c.req.param('site');
    const pathSid = c.req.param('sid');
    if (pathSite) params.site = pathSite;
    if (pathSid) params.sid = pathSid;

    // 3. 最高优先级：POST body（覆盖所有）
    if (c.req.method === 'POST') {
        const body = await parseJsonBody(c);
        // Only accept strings; ignore other types to avoid runtime errors downstream.
        if (typeof body?.url === 'string') params.url = body.url;
        if (typeof body?.site === 'string') params.site = body.site;
        if (typeof body?.sid === 'string') params.sid = body.sid;
        if (typeof body?.format === 'string') params.format = body.format;
    }

    return params;
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
