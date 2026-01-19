/**
 * 原始数据类型定义
 * 用于描述从各站点爬取到的、尚未规范化的原始数据结构。
 */

export interface BaseRawData {
    site: string;
    success: boolean;
    error?: string;
}

export interface DoubanRawData extends BaseRawData {
    site: 'douban';
    sid: string;
    html?: string;     // 原始 HTML
    json?: any;        // JSON-LD 数据
    mobile_html?: string; // 移动端 HTML
    // 其他爬虫特定字段
    [key: string]: any;
}

export interface TmdbRawData extends BaseRawData {
    site: 'tmdb';
    tmdb_id: string;
    details?: any;     // API 响应
    credits?: any;
    // 其他 API 响应数据
    [key: string]: any;
}

// 联合类型，未来可以扩展更多站点
export type RawData = DoubanRawData | TmdbRawData | (BaseRawData & { [key: string]: any });
