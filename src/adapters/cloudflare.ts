import { createCloudflareRuntime } from '../runtime/cloudflare';

/**
 * Cloudflare Workers 入口
 */

// 缓存应用实例（只初始化一次）
let cachedAppPromise: Promise<any> | null = null;

export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (!cachedAppPromise) {
      cachedAppPromise = createCloudflareRuntime(env);
    }

    const app = await cachedAppPromise;
    return app.fetch(request, env, ctx);
  },
};
