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
    indienovaCookie?: string;

    // IMDB 配置
    imdbUserAgent?: string;
    imdbTimeoutMs?: number;

    // TMDB 配置
    tmdbApiKey?: string;
    tmdbTimeoutMs?: number;
    tmdbUserAgent?: string;

    // Worker Env Config
    apikey?: string;
    disableSearch?: boolean;
    enableDebug?: boolean;
    htmlPage?: string;
    cacheTTL?: number;

    // 通用配置
    timeout?: number;
    proxyUrl?: string; // 可选的代理地址
    // 是否允许在使用 proxyUrl 时转发敏感请求头（Cookie/Authorization）。
    // 默认 false：避免将敏感信息泄露给不可信的中转服务。
    proxyAllowSensitiveHeaders?: boolean;
}
