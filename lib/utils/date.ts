import { ensureArray } from './array';

/**
 * 提取可排序的日期键
 * @param s 日期字符串
 */
export function extractSortableDateKey(s: string | null | undefined): string {
    // Normalize common patterns like:
    // - "2022-06-10(美国/中国大陆)" -> "2022-06-10"
    // - "2022-06-10" -> "2022-06-10"
    // - "" -> ""
    const m = String(s || '').match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}

/**
 * 对上映日期进行排序
 * @param list 日期列表
 */
export function sortPlaydates(list: string | string[] | null | undefined): string[] {
    const items = ensureArray(list)
        .map((v) => String(v).trim())
        .filter(Boolean);

    return items
        .map((v, i) => ({ v, i, k: extractSortableDateKey(v) }))
        .sort((a, b) => {
            if (a.k && b.k) {
                const da = new Date(a.k);
                const db = new Date(b.k);
                const diff = da.getTime() - db.getTime();
                if (!Number.isNaN(diff) && diff !== 0) return diff;
            }
            // Stable fallback.
            return a.i - b.i;
        })
        .map((x) => x.v);
}
