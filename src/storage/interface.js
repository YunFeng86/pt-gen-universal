/**
 * 存储抽象接口
 * 所有存储实现必须遵循此接口
 */

/**
 * @typedef {Object} Storage
 * @property {function(string): Promise<string|null>} get - 获取缓存值
 * @property {function(string, string, number=): Promise<void>} put - 存储缓存值
 * @property {function(string): Promise<void>} delete - 删除缓存值
 */
