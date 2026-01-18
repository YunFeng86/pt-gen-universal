/**
 * 统一格式化器模块
 * 将数据解析与排版逻辑解耦，支持多种输出格式
 */

/**
 * 规范化可能为数组的值
 * @param {*} value - 可能为数组或字符串的值
 * @returns {string}
 */
function normalizeMaybeArray(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.join('/');
    return String(value);
}

/**
 * 规范化人物列表
 * @param {Array} list - 人物列表
 * @returns {Array<string>}
 */
function normalizePeople(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((x) => {
            if (x == null) return '';
            if (typeof x === 'string') return x.trim();
            if (typeof x === 'object' && x['name']) return String(x['name']).trim();
            return '';
        })
        .filter(Boolean);
}

/**
 * 确保值为数组
 * @param {*} value
 * @returns {Array}
 */
function ensureArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

/**
 * BBCode 格式化器
 */
class BBCodeFormatter {
    /**
     * 格式化电影/剧集信息为 BBCode
     * @param {Object} data - 标准化的元数据对象
     * @returns {string} BBCode 格式的描述文本
     */
    format(data) {
        const poster = String(data?.poster || '');
        const trans_title = normalizeMaybeArray(data?.trans_title).trim();
        const this_title = normalizeMaybeArray(data?.this_title).trim();
        const year = String(data?.year || '').trim();
        const region = Array.isArray(data?.region) ? data.region.join(' / ') : String(data?.region || '');
        const genre = ensureArray(data?.genre).filter(Boolean);
        const language = Array.isArray(data?.language) ? data.language.join(' / ') : String(data?.language || '');
        const playdate = ensureArray(data?.playdate).filter(Boolean);
        const imdb_rating = String(data?.imdb_rating || '');
        const imdb_link = String(data?.imdb_link || '');
        const douban_rating = String(data?.douban_rating || '');
        const douban_link = String(data?.douban_link || '');
        const tmdb_rating = String(data?.tmdb_rating || '');
        const tmdb_link = String(data?.tmdb_link || '');
        const episodes = String(data?.episodes || '');
        const seasons = String(data?.seasons || '');
        const duration = String(data?.duration || '');
        const director = normalizePeople(data?.director);
        const writer = normalizePeople(data?.writer);
        const cast = normalizePeople(data?.cast);
        const tags = ensureArray(data?.tags).filter(Boolean);
        const introduction = String(data?.introduction || '');
        const awards = String(data?.awards || '');

        let descr = poster ? `[img]${poster}[/img]\n\n` : '';
        descr += trans_title ? `◎译　　名　${trans_title}\n` : '';
        descr += this_title ? `◎片　　名　${this_title}\n` : '';
        descr += year ? `◎年　　代　${year}\n` : '';
        descr += region ? `◎产　　地　${region}\n` : '';
        descr += genre.length > 0 ? `◎类　　别　${genre.join(' / ')}\n` : '';
        descr += language ? `◎语　　言　${language}\n` : '';
        descr += playdate.length > 0 ? `◎上映日期　${playdate.join(' / ')}\n` : '';
        descr += imdb_rating ? `◎IMDb评分  ${imdb_rating}\n` : '';
        descr += imdb_link ? `◎IMDb链接  ${imdb_link}\n` : '';
        descr += douban_rating ? `◎豆瓣评分　${douban_rating}\n` : '';
        descr += douban_link ? `◎豆瓣链接　${douban_link}\n` : '';
        descr += tmdb_rating ? `◎TMDB评分　${tmdb_rating}\n` : '';
        descr += tmdb_link ? `◎TMDB链接　${tmdb_link}\n` : '';
        descr += seasons ? `◎季　　数　${seasons}\n` : '';
        descr += episodes ? `◎集　　数　${episodes}\n` : '';
        descr += duration ? `◎片　　长　${duration}\n` : '';
        descr += director.length > 0 ? `◎导　　演　${director.join(' / ')}\n` : '';
        descr += writer.length > 0 ? `◎编　　剧　${writer.join(' / ')}\n` : '';
        descr += cast.length > 0
            ? `◎主　　演　${cast.join('\n' + '　'.repeat(4) + '  　').trim()}\n`
            : '';
        descr += tags.length > 0 ? `\n◎标　　签　${tags.join(' | ')}\n` : '';
        descr += introduction
            ? `\n◎简　　介\n\n　　${introduction.replace(/\n/g, '\n' + '　'.repeat(2))}\n`
            : '';
        descr += awards ? `\n◎获奖情况\n\n　　${awards.replace(/\n/g, '\n' + '　'.repeat(2))}\n` : '';

        return descr.trim();
    }
}

/**
 * Markdown 格式化器（可选）
 */
class MarkdownFormatter {
    /**
     * 格式化电影/剧集信息为 Markdown
     * @param {Object} data - 标准化的元数据对象
     * @returns {string} Markdown 格式的描述文本
     */
    format(data) {
        const poster = String(data?.poster || '');
        const trans_title = normalizeMaybeArray(data?.trans_title).trim();
        const this_title = normalizeMaybeArray(data?.this_title).trim();
        const year = String(data?.year || '').trim();
        const region = Array.isArray(data?.region) ? data.region.join(' / ') : String(data?.region || '');
        const genre = ensureArray(data?.genre).filter(Boolean);
        const language = Array.isArray(data?.language) ? data.language.join(' / ') : String(data?.language || '');
        const playdate = ensureArray(data?.playdate).filter(Boolean);
        const imdb_rating = String(data?.imdb_rating || '');
        const imdb_link = String(data?.imdb_link || '');
        const douban_rating = String(data?.douban_rating || '');
        const douban_link = String(data?.douban_link || '');
        const tmdb_rating = String(data?.tmdb_rating || '');
        const tmdb_link = String(data?.tmdb_link || '');
        const episodes = String(data?.episodes || '');
        const seasons = String(data?.seasons || '');
        const duration = String(data?.duration || '');
        const director = normalizePeople(data?.director);
        const writer = normalizePeople(data?.writer);
        const cast = normalizePeople(data?.cast);
        const tags = ensureArray(data?.tags).filter(Boolean);
        const introduction = String(data?.introduction || '');
        const awards = String(data?.awards || '');

        let descr = poster ? `![海报](${poster})\n\n` : '';
        descr += `## 基本信息\n\n`;
        descr += trans_title ? `- **译名**: ${trans_title}\n` : '';
        descr += this_title ? `- **片名**: ${this_title}\n` : '';
        descr += year ? `- **年代**: ${year}\n` : '';
        descr += region ? `- **产地**: ${region}\n` : '';
        descr += genre.length > 0 ? `- **类别**: ${genre.join(' / ')}\n` : '';
        descr += language ? `- **语言**: ${language}\n` : '';
        descr += playdate.length > 0 ? `- **上映日期**: ${playdate.join(' / ')}\n` : '';
        descr += seasons ? `- **季数**: ${seasons}\n` : '';
        descr += episodes ? `- **集数**: ${episodes}\n` : '';
        descr += duration ? `- **片长**: ${duration}\n` : '';

        if (imdb_rating || douban_rating || tmdb_rating) {
            descr += `\n## 评分\n\n`;
            descr += imdb_rating ? `- **IMDb**: ${imdb_rating}` : '';
            descr += imdb_link ? ` ([链接](${imdb_link}))` : '';
            descr += imdb_rating ? `\n` : '';
            descr += douban_rating ? `- **豆瓣**: ${douban_rating}` : '';
            descr += douban_link ? ` ([链接](${douban_link}))` : '';
            descr += douban_rating ? `\n` : '';
            descr += tmdb_rating ? `- **TMDB**: ${tmdb_rating}` : '';
            descr += tmdb_link ? ` ([链接](${tmdb_link}))` : '';
            descr += tmdb_rating ? `\n` : '';
        }

        if (director.length > 0 || writer.length > 0 || cast.length > 0) {
            descr += `\n## 制作人员\n\n`;
            descr += director.length > 0 ? `- **导演**: ${director.join(' / ')}\n` : '';
            descr += writer.length > 0 ? `- **编剧**: ${writer.join(' / ')}\n` : '';
            descr += cast.length > 0 ? `- **主演**: ${cast.join(' / ')}\n` : '';
        }

        descr += tags.length > 0 ? `\n## 标签\n\n${tags.join(' | ')}\n` : '';
        descr += introduction ? `\n## 简介\n\n${introduction}\n` : '';
        descr += awards ? `\n## 获奖情况\n\n${awards}\n` : '';

        return descr.trim();
    }
}

/**
 * 格式化器工厂
 */
const formatters = {
    bbcode: new BBCodeFormatter(),
    markdown: new MarkdownFormatter(),
};

/**
 * 格式化电影/剧集信息
 * @param {Object} data - 标准化的元数据对象
 * @param {string} format - 格式类型 ('bbcode' | 'markdown')
 * @returns {string} 格式化后的文本
 */
export function formatMovieInfo(data, format = 'bbcode') {
    const formatter = formatters[format] || formatters.bbcode;
    return formatter.format(data);
}

export { BBCodeFormatter, MarkdownFormatter };
