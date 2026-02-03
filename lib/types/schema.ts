/**
 * 统一数据架构定义
 * 这些类型定义了规范化层(Normalizers)输出的数据结构，
 * 同时也是格式化层(Formatters)输入的数据结构。
 */

/**
 * 评分信息
 */
export interface RatingInfo {
    average: number;       // 平均分 (e.g., 8.9)
    votes: number;         // 评分人数
    formatted: string;     // 格式化字符串 (e.g., "8.9/10 from 12345 users")
    link: string;          // 评分页面链接
}

/**
 * 站点特定的额外信息（原 extra 字段的收敛版）。
 * 说明：为兼容旧实现/旧测试，这里保留部分常用键的类型。
 */
export interface MediaExtras {
    [key: string]: unknown;

    // Common/legacy overrides
    descr_bbcode?: string;

    // Bangumi
    staff?: string[];
    aliases?: string[];
    info_map?: Record<string, unknown>;
    rating?: number;
    votes?: number;

    // Games (Steam/GOG/Indienova)
    screenshots?: string[];
    platforms?: string[];
    price?: unknown;
    intro?: string;
    languages?: string[];
    languages_raw?: unknown;

    // Steam raw lines & sysreq parsing
    type_line?: string;
    dev_line?: string;
    pub_line?: string;
    release_line?: string;
    sysreq?: unknown;
    system_requirements?: unknown;
    windows_min?: string[];
    windows_rec?: string[];

    // IMDb
    details?: unknown;
    reviews?: unknown;
    metascore?: unknown;

    // Indienova
    rate_stars?: unknown;
    rate_count?: unknown;
}

/**
 * 媒体基础信息
 */
export interface MediaInfo {
    // 基础信息
    site: string; // 来源站点 (e.g., "douban", "tmdb")
    id: string;   // 来源站点的唯一ID
    link?: string; // 详情页链接

    // 兼容字段（历史版本/旧测试用）
    title?: string; // @deprecated use chinese_title/foreign_title/this_title
    original_title?: string; // @deprecated use foreign_title/this_title

    // 标题信息
    chinese_title: string;          // 中文标题
    foreign_title: string;          // 外文标题
    aka: string[];                  // 又名/别名列表
    trans_title: string[];          // 译名列表 (通常用于显示)
    this_title: string[];           // 本名列表 (通常用于显示)

    // 媒体属性
    year: string;                   // 年份 (e.g., "2024")
    playdate: string[];             // 上映/首播日期
    region: string[];               // 产地/国家
    genre: string[];                // 类型 (e.g., "剧情", "动作")
    language: string[];             // 语言
    duration: string;               // 片长 (e.g., "120分钟")
    episodes: string;               // 集数 (剧集特有)
    seasons: string;                // 季数 (剧集特有)

    // 视觉信息
    poster: string;                 // 海报图片链接

    // 演职员表
    director: string[];             // 导演
    writer: string[];               // 编剧
    cast: string[];                 // 主演

    // 描述信息
    introduction: string;           // 剧情简介
    awards: string;                 // 获奖情况
    tags: string[];                 // 标签

    // 评分信息（结构化）
    ratings?: {
        douban?: RatingInfo;
        imdb?: RatingInfo;
        tmdb?: RatingInfo;
        bangumi?: RatingInfo;
    };

    // 外部 ID
    imdb_id?: string;               // IMDb ID
    tmdb_id?: string;               // TMDB ID

    // 兼容字段（历史版本/旧测试用）
    douban_rating_average?: number;
    douban_votes?: number;
    douban_rating?: string;
    douban_link?: string;

    imdb_rating_average?: number;
    imdb_votes?: number;
    imdb_rating?: string;
    imdb_link?: string;

    tmdb_rating_average?: number;
    tmdb_votes?: number;
    tmdb_rating?: string;
    tmdb_link?: string;

    bangumi_rating_average?: number;
    bangumi_votes?: number;

    // 扩展字段 (用于存储各站点特有的额外信息)
    screenshots?: string[];         // 截图列表
    website?: string;               // 官方网站

    // 游戏特定信息
    game_info?: {
        platform?: string[];        // 平台 (Windows, Mac, etc.)
        developer?: string[];       // 开发商
        publisher?: string[];       // 发行商
        price?: string[];           // 价格信息
        level?: string[];           // 分级信息
        links?: Record<string, string>; // 外部链接
        spec?: Record<string, unknown>; // 系统需求
        ui_lang?: string[];         // 界面语言
        audio_lang?: string[];      // 音频语言
        sub_lang?: string[];        // 字幕语言
    };

    // 站点特定的额外信息（替代 [key: string]: any）
    extras?: MediaExtras;
    // @deprecated legacy alias
    extra?: MediaExtras;
}

/**
 * 搜索结果项
 */
export interface SearchResult {
    provider: string; // 提供者 ID (e.g. "douban")
    id: string;       // 资源 ID
    title: string;    // 标题
    subtitle?: string;// 副标题 (e.g. 原名)
    year?: string;    // 年份
    type?: string;    // 类型 (movie, tv, etc.)
    link: string;     // 详情页链接
    poster?: string;  // 海报
    extra?: any;      // 额外信息
}
