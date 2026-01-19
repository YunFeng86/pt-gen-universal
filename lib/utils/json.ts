/**
 * 安全解析 JSON
 * @param raw 原始字符串
 */
export function safeJsonParse<T = any>(raw: string | null | undefined): T | null {
    if (!raw) return null;
    try {
        return JSON.parse(String(raw).replace(/(\r\n|\n|\r|\t)/gm, ''));
    } catch {
        return null;
    }
}

/**
 * 解析 JSONP 返回
 * @param responseText 响应文本
 */
export function jsonpParser<T = any>(responseText: string): T {
    try {
        const text = responseText.replace(/\n/ig, '').match(/[^(]+\((.+)\)/)?.[1];
        if (!text) return {} as T;
        return JSON.parse(text);
    } catch (e) {
        return {} as T;
    }
}
