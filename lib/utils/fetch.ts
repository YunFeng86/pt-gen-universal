const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * 带超时的 Fetch
 * @param url 请求 URL
 * @param init Fetch 选项
 * @param timeoutMs 超时时间（毫秒）
 */
export async function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}
