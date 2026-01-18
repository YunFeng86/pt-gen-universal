/**
 * 轻量级频率限制器
 * 使用令牌桶算法，针对每个站点独立计数
 */

class RateLimiter {
    constructor(options = {}) {
        this.buckets = new Map() // 每个站点的令牌桶
        this.defaultRate = options.rate || 10 // 每秒补充的令牌数
        this.defaultCapacity = options.capacity || 20 // 令牌桶容量
    }

    /**
     * 获取指定站点的令牌桶
     * @param {string} site - 站点名称 (douban/imdb/tmdb等)
     */
    getBucket(site) {
        if (!this.buckets.has(site)) {
            this.buckets.set(site, {
                tokens: this.defaultCapacity,
                lastRefill: Date.now(),
                capacity: this.defaultCapacity,
                rate: this.defaultRate
            })
        }
        return this.buckets.get(site)
    }

    /**
     * 补充令牌
     * @param {Object} bucket - 令牌桶
     */
    refillTokens(bucket) {
        const now = Date.now()
        const timePassed = (now - bucket.lastRefill) / 1000 // 秒
        const tokensToAdd = timePassed * bucket.rate

        bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd)
        bucket.lastRefill = now
    }

    /**
     * 尝试获取一个令牌
     * @param {string} site - 站点名称
     * @returns {Promise<boolean>} 是否成功获取令牌
     */
    async tryAcquire(site) {
        const bucket = this.getBucket(site)
        this.refillTokens(bucket)

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1
            return true
        }

        return false
    }

    /**
     * 等待并获取令牌（阻塞式）
     * @param {string} site - 站点名称
     * @param {number} maxWaitMs - 最大等待时间（毫秒）
     * @returns {Promise<boolean>} 是否成功获取令牌
     */
    async acquire(site, maxWaitMs = 5000) {
        const startTime = Date.now()

        while (Date.now() - startTime < maxWaitMs) {
            if (await this.tryAcquire(site)) {
                return true
            }

            // 等待一小段时间后重试
            await this.sleep(100)
        }

        return false
    }

    /**
     * 辅助函数：睡眠指定毫秒数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * 重置指定站点的限制
     * @param {string} site - 站点名称
     */
    reset(site) {
        this.buckets.delete(site)
    }
}

// 创建全局单例
const rateLimiter = new RateLimiter()

export { RateLimiter, rateLimiter }
