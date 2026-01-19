import { AppConfig } from '../types/config';
import { RawData } from '../types/raw-data';
import { MediaInfo } from '../types/schema';

/**
 * 规范化器接口
 * 负责将爬取到的原始数据转换为统一的 MediaInfo 结构。
 */
export interface Normalizer {
    /**
     * 规范化数据
     * @param rawData 原始数据
     * @param config 全局配置
     */
    normalize(rawData: RawData, config: AppConfig): MediaInfo;
}
