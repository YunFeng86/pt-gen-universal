import { ensureArray } from './array';

/**
 * 规范化可能为数组的值
 * @param value - 可能为数组或字符串的值
 * @returns 连接后的字符串
 */
export function normalizeMaybeArray(value: string | string[] | null | undefined): string {
    if (value == null) return '';
    if (Array.isArray(value)) return value.join('/');
    return String(value);
}

/**
 * 规范化人物列表
 * @param list - 人物列表
 * @returns 规范化后的人物名数组
 */
export function normalizePeople(list: any): string[] {
    return ensureArray(list)
        .map((x) => {
            if (x == null) return '';
            if (typeof x === 'string') return x.trim();
            if (typeof x === 'object' && x['name']) return String(x['name']).trim();
            return '';
        })
        .filter(Boolean);
}

/**
 * 规范化 Cookie 字符串
 * @param cookie Cookie 字符串
 */
export function normalizeCookie(cookie: string | null | undefined): string {
    if (!cookie) return '';
    return String(cookie).trim().replace(/;+\s*$/, '');
}

/**
 * 合并多个 Cookie
 * @param cookies Cookie 列表
 */
export function mergeCookies(...cookies: (string | null | undefined)[]): string {
    return cookies
        .map(normalizeCookie)
        .filter(Boolean)
        .join('; ');
}

/**
 * 提取 cheerio 节点的文本内容
 * @param anchor Cheerio 对象
 */
export function fetchAnchorText(anchor: any): string {
    const node = anchor?.[0]?.nextSibling;
    const value = node?.nodeValue;
    return value ? String(value).trim() : '';
}
