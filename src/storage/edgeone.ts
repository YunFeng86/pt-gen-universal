import { CloudflareKVStorage } from './cloudflare';

/**
 * EdgeOne Pages KV 存储适配器
 * 当前接口与 Cloudflare KV 兼容，沿用同样的 get/put/delete 约定。
 */
export class EdgeOneKVStorage extends CloudflareKVStorage {}
