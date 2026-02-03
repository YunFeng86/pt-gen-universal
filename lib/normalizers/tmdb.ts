
import { Normalizer } from '../interfaces/normalizer';
import { TmdbRawData } from '../types/raw-data';
import { MediaInfo } from '../types/schema';
import { AppConfig } from '../types/config';

export class TmdbNormalizer implements Normalizer {
    normalize(rawData: TmdbRawData, config: AppConfig): MediaInfo {
        const data = rawData;
        const mediaType = data.media_type || 'movie';

        const title = data.title || data.name || '';
        const originalTitle = data.original_title || data.original_name || '';
        const tmdbLink = `https://www.themoviedb.org/${mediaType}/${data.tmdb_id}`;
        const year = data.release_date
            ? data.release_date.substring(0, 4)
            : (data.first_air_date ? data.first_air_date.substring(0, 4) : '');

        const info: MediaInfo = {
            site: 'tmdb',
            id: data.tmdb_id,
            link: tmdbLink,

            // Legacy compat
            title: title,
            original_title: originalTitle || title,
            introduction: data.overview || '暂无相关剧情介绍',
            poster: data.poster_path ? `https://image.tmdb.org/t/p/original${data.poster_path}` : '',

            // TMDB specific
            tmdb_id: data.tmdb_id,
            tmdb_link: tmdbLink,
            tmdb_rating_average: data.vote_average || 0,
            tmdb_votes: data.vote_count || 0,
            tmdb_rating: data.vote_average && data.vote_count
                ? `${data.vote_average}/10 from ${data.vote_count} users`
                : '',
            ratings: (data.vote_average && data.vote_count) ? {
                tmdb: {
                    average: data.vote_average,
                    votes: data.vote_count,
                    formatted: `${data.vote_average}/10 from ${data.vote_count} users`,
                    link: tmdbLink
                }
            } : undefined,

            genre: (data.genres || []).map(g => g.name),
            region: (data.production_countries || []).map(c => c.name),
            language: (data.spoken_languages || []).map(l => l.name),
            playdate: [data.release_date || data.first_air_date || ''].filter(Boolean),

            trans_title: [],
            this_title: [originalTitle],

            tags: [],
            director: [],
            writer: [],
            cast: [],

            episodes: '',
            seasons: '',
            duration: '',
            awards: '',

            // Required MediaInfo fields
            chinese_title: '',
            foreign_title: originalTitle,
            aka: [],
            year: year,
        };

        // AKA/Titles
        let aka: string[] = [];
        if (data.alternative_titles) {
            const titles = data.alternative_titles.titles || data.alternative_titles.results || [];

            const isChineseTitle = /[\u4e00-\u9fa5]/.test(originalTitle);

            if (isChineseTitle) {
                const englishTitles = titles
                    .filter(t => t.iso_3166_1 === 'US' || t.iso_3166_1 === 'GB' || t.iso_639_1 === 'en')
                    .map(t => t.title);
                if (englishTitles.length > 0) aka = englishTitles;
                else aka = titles.filter(t => !['CN', 'TW', 'HK'].includes(t.iso_3166_1)).map(t => t.title);
            } else {
                const chineseTitles = titles
                    .filter(t => ['CN', 'TW', 'HK'].includes(t.iso_3166_1))
                    .map(t => t.title);
                if (chineseTitles.length > 0) aka = chineseTitles;
            }
        }
        info.aka = aka;

        info.trans_title = [];
        if (title !== originalTitle) {
            info.trans_title.push(title);
            // Assuming title is Chinese if it differs from original
            info.chinese_title = title;
        } else {
            // Check if title itself is Chinese
            if (/[\u4e00-\u9fa5]/.test(title)) {
                info.chinese_title = title;
            }
        }

        info.trans_title.push(...aka);
        info.trans_title = Array.from(new Set(info.trans_title));

        // Duration / Episodes
        if (mediaType === 'tv') {
            info.episodes = data.number_of_episodes ? data.number_of_episodes.toString() : '';
            info.seasons = data.number_of_seasons ? data.number_of_seasons.toString() : '';
            if (data.episode_run_time && data.episode_run_time.length > 0) {
                info.duration = `${data.episode_run_time[0]} 分钟`;
            }
        } else {
            if (data.runtime) info.duration = `${data.runtime} 分钟`;
        }

        // Credits - Map to strings to match MediaInfo types
        if (data.credits) {
            if (mediaType === 'movie' && data.credits.crew) {
                info.director = data.credits.crew
                    .filter((p: any) => p.job === 'Director')
                    .map((d: any) => d.name);
            } else if (data.created_by) {
                info.director = data.created_by.map((d: any) => d.name);
            }

            if (data.credits.crew) {
                info.writer = data.credits.crew
                    .filter((p: any) => ['Writer', 'Screenplay', 'Story'].includes(p.job))
                    .map((w: any) => w.name);
            }
            if (data.credits.cast) {
                info.cast = data.credits.cast
                    .slice(0, 20)
                    .map((c: any) => c.name);
            }
        }

        // External IDs
        if (data.external_ids && data.external_ids.imdb_id) {
            info.imdb_id = data.external_ids.imdb_id;
            info.imdb_link = `https://www.imdb.com/title/${data.external_ids.imdb_id}/`;
        }

        // Keywords
        if (data.keywords) {
            const kws = data.keywords.keywords || data.keywords.results || [];
            info.tags = kws.map((k: any) => k.name);
        }

        return info;
    }
}
