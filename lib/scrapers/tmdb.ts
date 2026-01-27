
import { Scraper } from '../interfaces/scraper';
import { AppConfig } from '../types/config';
import { TmdbRawData } from '../types/raw-data';
import { SearchResult } from '../types/schema';
import { fetchWithTimeout } from '../utils/fetch';
import { NONE_EXIST_ERROR } from '../utils/error';

const DEFAULT_TIMEOUT_MS = 10_000;

export class TmdbScraper implements Scraper {
    async fetch(id: string, config: AppConfig): Promise<TmdbRawData> {
        const apiKey = config.tmdbApiKey;
        if (!apiKey) {
            throw new Error("TMDB API key is required. Please set TMDB_API_KEY.");
        }

        const timeoutMs =
            config.tmdbTimeoutMs ??
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        const headers: Record<string, string> = {};
        if (config.tmdbUserAgent) {
            headers['User-Agent'] = config.tmdbUserAgent;
        }
        const requestInit = Object.keys(headers).length > 0 ? { headers } : {};

        let mediaType = 'movie';
        let tmdbId = id;

        // Handle URL or composite ID (movie-12345)
        if (id.startsWith('http')) {
            try {
                const url = new URL(id);
                const pathSegments = url.pathname.split('/').filter(segment => segment);
                if (pathSegments.length >= 2) {
                    mediaType = pathSegments[0]; // 'movie' or 'tv'
                    let idPart = pathSegments[1];
                    if (idPart.includes('-')) {
                        idPart = idPart.split('-')[0];
                    }
                    tmdbId = idPart;
                } else {
                    throw new Error("Invalid TMDB URL format");
                }
            } catch (e: any) {
                throw new Error(`URL parsing failed: ${e.message}`);
            }
        } else if (id.includes('-')) {
            const parts = id.split('-');
            mediaType = parts[0];
            tmdbId = parts[1];
        }

        const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=zh-CN&append_to_response=credits,external_ids,images,keywords,release_dates,content_ratings,videos,alternative_titles`;

        const response = await fetchWithTimeout(url, requestInit, timeoutMs, config);

        if (!response.ok) {
            // Check for 404
            if (response.status === 404) {
                throw new Error(NONE_EXIST_ERROR);
            }
            throw new Error(`TMDB API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success === false) {
            throw new Error(data.status_message || NONE_EXIST_ERROR);
        }

        // Add site and success to satisfy BaseRawData
        return {
            site: 'tmdb',
            success: true,
            tmdb_id: tmdbId,
            media_type: mediaType as 'movie' | 'tv',
            ...data
        };
    }

    async search(query: string, config: AppConfig): Promise<SearchResult[]> {
        const apiKey = config.tmdbApiKey;
        if (!apiKey) {
            throw new Error("TMDB API key is required.");
        }

        const timeoutMs =
            config.tmdbTimeoutMs ??
            config.timeout ??
            DEFAULT_TIMEOUT_MS;
        const headers: Record<string, string> = {};
        if (config.tmdbUserAgent) {
            headers['User-Agent'] = config.tmdbUserAgent;
        }
        const requestInit = Object.keys(headers).length > 0 ? { headers } : {};

        const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=zh-CN`;
        const response = await fetchWithTimeout(url, requestInit, timeoutMs, config);

        if (!response.ok) {
            throw new Error(`TMDB Search failed: ${response.status}`);
        }

        const json = await response.json();
        if (json.success === false) {
            throw new Error(json.status_message || "Search failed");
        }

        return (json.results || [])
            .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
            .map((item: any) => {
                const year = item.release_date
                    ? item.release_date.substring(0, 4)
                    : (item.first_air_date ? item.first_air_date.substring(0, 4) : '');

                return {
                    provider: 'tmdb',
                    id: `${item.media_type}-${item.id}`,
                    title: item.title || item.name,
                    year: year,
                    date: item.release_date || item.first_air_date,
                    subtitle: item.original_title || item.original_name,
                    link: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
                    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
                    extra: {
                        media_type: item.media_type
                    }
                };
            });
    }
}
