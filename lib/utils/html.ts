import * as cheerio from 'cheerio';

/**
 * 解析 HTML 页面
 * @param responseText HTML 文本
 */
export function pageParser(responseText: string): cheerio.CheerioAPI {
    return cheerio.load(responseText, {
        xml: false, // Explicitly set XML mode to false if needed, or rely on default
    });
}
