import type { Context } from 'hono';
import type { Storage } from '../storage/storage';

/**
 * Rate Limiting 中间件
 * 基于 IP 的滑动窗口限流
 */
export class RateLimiter {
    constructor(
        private readonly storage: Storage,
        private readonly maxRequests: number = 60, // 每分钟最大请求数
        private readonly windowMs: number = 60000,  // 时间窗口（毫秒）
        private readonly prefix = 'ptgen:ratelimit:'
    ) {}

    isEnabled(): boolean {
        return this.maxRequests > 0;
    }

    async check(c: Context): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
        if (!this.isEnabled()) {
            return { allowed: true, remaining: this.maxRequests, resetAt: Date.now() + this.windowMs };
        }

        const ip = this.getClientIP(c);
        const key = `${this.prefix}${ip}`;
        const now = Date.now();
        const windowStart = now - this.windowMs;

        try {
            // 获取当前计数
            const cached = await this.storage.get(key);
            let requests: number[] = cached ? JSON.parse(cached) : [];

            // 移除过期的请求记录
            requests = requests.filter(timestamp => timestamp > windowStart);

            // 检查是否超出限制
            if (requests.length >= this.maxRequests) {
                const oldestRequest = requests[0];
                const resetAt = oldestRequest + this.windowMs;
                return {
                    allowed: false,
                    remaining: 0,
                    resetAt
                };
            }

            // 记录新请求
            requests.push(now);
            await this.storage.put(key, JSON.stringify(requests), Math.ceil(this.windowMs / 1000));

            return {
                allowed: true,
                remaining: this.maxRequests - requests.length,
                resetAt: now + this.windowMs
            };
        } catch (error) {
            // Rate limiting 失败不应阻塞请求
            console.error('[RateLimiter] Error:', error);
            return { allowed: true, remaining: this.maxRequests, resetAt: now + this.windowMs };
        }
    }

    private getClientIP(c: Context): string {
        // 优先从 CF-Connecting-IP 获取（Cloudflare Workers）
        const cfIP = c.req.header('cf-connecting-ip');
        if (cfIP) return cfIP;

        // X-Forwarded-For（代理环境）
        const forwarded = c.req.header('x-forwarded-for');
        if (forwarded) return forwarded.split(',')[0].trim();

        // X-Real-IP（Nginx 等）
        const realIP = c.req.header('x-real-ip');
        if (realIP) return realIP;

        // 回退到 unknown（应该永远不会发生）
        return 'unknown';
    }
}

/**
 * 创建 Rate Limiting 中间件
 */
export function createRateLimitMiddleware(storage: Storage, maxRequestsPerMinute: number = 60) {
    const limiter = new RateLimiter(storage, maxRequestsPerMinute);

    return async (c: Context, next: () => Promise<void>) => {
        if (!limiter.isEnabled()) {
            return next();
        }

        const { allowed, remaining, resetAt } = await limiter.check(c);

        // 添加 Rate Limit 响应头
        c.header('X-RateLimit-Limit', String(maxRequestsPerMinute));
        c.header('X-RateLimit-Remaining', String(remaining));
        c.header('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));

        if (!allowed) {
            return c.json(
                {
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: 'Too many requests. Please try again later.',
                        details: {
                            limit: maxRequestsPerMinute,
                            remaining: 0,
                            reset_at: Math.floor(resetAt / 1000)
                        }
                    }
                },
                429
            );
        }

        await next();
    };
}
