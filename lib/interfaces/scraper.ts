import { AppConfig } from '../types/config';
import { RawData } from '../types/raw-data';
import { SearchResult } from '../types/schema';

/**
 * 爬虫接口
 * 负责从各站点抓取原始数据。
 */
export interface Scraper {
    /**
     * 根据 ID 获取原始数据
     * @param id 资源 ID
     * @param config 全局配置
     */
    fetch(id: string, config: AppConfig): Promise<RawData>;

    /**
     * 搜索资源
     * @param query 搜索关键词
     * @param config 全局配置
     */
    search(query: string, config: AppConfig): Promise<SearchResult[]>;
}
