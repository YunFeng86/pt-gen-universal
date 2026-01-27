import type { AppConfig } from '../types/config';

const DEFAULT_TIMEOUT_MS = 10_000;

function buildProxiedUrl(proxyUrl: string, targetUrl: string): string {
    const proxy = String(proxyUrl || '').trim();
    if (!proxy) return targetUrl;

    // Allow explicit templates.
    if (proxy.includes('{urlEncoded}')) {
        return proxy.replace('{urlEncoded}', encodeURIComponent(targetUrl));
    }
    if (proxy.includes('{url}')) {
        return proxy.replace('{url}', targetUrl);
    }

    // Heuristic 1: query-param relay (e.g. https://proxy.example/fetch?url= )
    if (proxy.includes('?')) {
        if (/[?&]url=$/.test(proxy)) return `${proxy}${encodeURIComponent(targetUrl)}`;

        // Handle "....?" / "....&" gracefully.
        const joiner = proxy.endsWith('?') || proxy.endsWith('&') ? '' : '&';
        return `${proxy}${joiner}url=${encodeURIComponent(targetUrl)}`;
    }

    // Heuristic 2: prefix relay (e.g. https://r.jina.ai/http://example.com)
    if (proxy.endsWith('/')) return `${proxy}${targetUrl}`;
    return `${proxy}/${targetUrl}`;
}

function hasSensitiveRequestHeaders(headers: RequestInit['headers']): boolean {
    if (!headers) return false;
    // Normalize across Headers / Record / tuple array.
    const h = new Headers(headers as any);
    return h.has('cookie') || h.has('authorization');
}

/**
 * 带超时的 Fetch
 * @param url 请求 URL
 * @param init Fetch 选项
 * @param timeoutMs 超时时间（毫秒）
 * @param config 可选 AppConfig（用于 proxyUrl 等）
 */
export async function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    config?: AppConfig
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const method = String((init as any)?.method || 'GET').toUpperCase();
        const hasBody = (init as any)?.body != null;
        const hasSensitiveHeaders = hasSensitiveRequestHeaders((init as any)?.headers);

        // Proxy support is best-effort:
        // - only applied for GET-without-body, so we don't accidentally break POST/streaming requests
        // - uses a simple "relay" URL builder; see buildProxiedUrl()
        // - by default, we skip proxying when Cookie/Authorization are present to avoid leaking secrets to relays
        const finalUrl =
            config?.proxyUrl && method === 'GET' && !hasBody
                ? hasSensitiveHeaders && !config?.proxyAllowSensitiveHeaders
                    ? url
                    : buildProxiedUrl(config.proxyUrl, url)
                : url;

        return await fetch(finalUrl, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}
