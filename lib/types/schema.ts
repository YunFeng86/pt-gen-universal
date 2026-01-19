/**
 * 统一数据架构定义
 * 这些类型定义了规范化层(Normalizers)输出的数据结构，
 * 同时也是格式化层(Formatters)输入的数据结构。
 */

/**
 * 媒体基础信息
 */
export interface MediaInfo {
    // 基础信息
    site: string; // 来源站点 (e.g., "douban", "tmdb")
    id: string;   // 来源站点的唯一ID

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

    // 评分信息
    douban_rating_average?: number; // 豆瓣平均分
    douban_votes?: number;          // 豆瓣评分人数
    douban_rating?: string;         // 豆瓣评分格式化字符串 (e.g., "8.9/10 from 12345 users")
    douban_link?: string;           // 豆瓣链接

    imdb_id?: string;               // IMDb ID
    imdb_rating_average?: number;   // IMDb 平均分
    imdb_votes?: number;            // IMDb 评分人数
    imdb_rating?: string;           // IMDb 评分格式化字符串
    imdb_link?: string;             // IMDb 链接

    tmdb_id?: string;               // TMDB ID
    tmdb_rating_average?: number;   // TMDB 平均分
    tmdb_votes?: number;            // TMDB 评分人数
    tmdb_rating?: string;           // TMDB 评分格式化字符串
    tmdb_link?: string;             // TMDB 链接

    // 扩展字段 (用于存储各站点特有的额外信息)
    [key: string]: any;
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
}
