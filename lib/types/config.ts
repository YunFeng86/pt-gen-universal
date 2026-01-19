/**
 * 全局配置类型定义
 * 定义了应用运行时所需的各种配置项，包括请求头、超时设置等。
 */

export interface AppConfig {
    // 豆瓣配置
    doubanCookie?: string;
    doubanUserAgent?: string;
    doubanAcceptLanguage?: string;
    doubanTimeoutMs?: number;
    doubanWarmupTimeoutMs?: number;
    doubanIncludeAwards?: boolean;
    doubanIncludeImdb?: boolean;

    // IMDB 配置
    imdbUserAgent?: string;
    imdbTimeoutMs?: number;

    // TMDB 配置
    tmdbApiKey?: string;
    tmdbTimeoutMs?: number;
    tmdbUserAgent?: string;

    // 通用配置
    timeout?: number;
    proxyUrl?: string; // 可选的代理地址
}
