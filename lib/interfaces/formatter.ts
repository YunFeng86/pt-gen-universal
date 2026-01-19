import { MediaInfo } from '../types/schema';

/**
 * 格式化器接口
 * 负责将 MediaInfo 格式化为特定的输出格式（如 BBCode, JSON, Markdown）。
 */
export interface Formatter {
    /**
     * 格式化数据
     * @param info 媒体信息
     */
    format(info: MediaInfo): string;
}
