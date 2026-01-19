/**
 * 确保值为数组
 * @param value 任意值
 * @returns 数组
 */
export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}
